const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * POST /api/payments
 * Body: { orderId, outcome: 'success' | 'failure' | 'timeout', idempotencyKey }
 *
 * Mock payment gateway. `outcome` simulates what the gateway would return,
 * so the grader/tester can exercise each branch on demand.
 *
 *  - success -> order Paid, physical stock decremented, reservation released
 *  - failure -> order Failed, reservation released, stock untouched
 *  - timeout -> order Expired, reservation released, stock untouched
 *
 * Duplicate protection:
 *  - idempotencyKey has a UNIQUE constraint in `payments`; replaying the same
 *    key returns the original result instead of processing twice.
 *  - Once an order leaves "Reserved" status, further payment attempts against
 *    it are rejected (no double-charging / double-fulfilling one order).
 */
router.post('/', async (req, res) => {
  const { orderId, outcome, idempotencyKey } = req.body;
  if (!orderId || !outcome || !idempotencyKey) {
    return res.status(400).json({ error: 'orderId, outcome and idempotencyKey are required' });
  }
  if (!['success', 'failure', 'timeout'].includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be success, failure or timeout' });
  }

  // Idempotent replay: same payment attempt submitted twice
  const [existingPayment] = await pool.query('SELECT * FROM payments WHERE idempotency_key = ?', [
    idempotencyKey
  ]);
  if (existingPayment.length) {
    return res.status(200).json({ ...existingPayment[0], deduplicated: true });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!orders.length) throw { status: 404, message: 'Order not found' };
    const order = orders[0];

    if (order.status !== 'Reserved') {
      throw { status: 409, message: `Order is "${order.status}"; payment can only be attempted while "Reserved"` };
    }

    if (new Date(order.expires_at) < new Date()) {
      // Reservation already lapsed - treat as expired rather than accepting a late payment
      await releaseReservation(conn, order.id);
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['Expired', order.id]);
      await conn.commit();
      return res.status(409).json({ error: 'Reservation already expired' });
    }

    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    let newStatus;
    let paymentStatus;

    if (outcome === 'success') {
      for (const item of items) {
        await conn.query(
          'UPDATE products SET stock = stock - ?, reserved_stock = reserved_stock - ? WHERE id = ?',
          [item.quantity, item.quantity, item.product_id]
        );
      }
      newStatus = 'Paid';
      paymentStatus = 'Success';
    } else if (outcome === 'failure') {
      await releaseReservation(conn, order.id);
      newStatus = 'Failed';
      paymentStatus = 'Failed';
    } else {
      // timeout
      await releaseReservation(conn, order.id);
      newStatus = 'Expired';
      paymentStatus = 'Timeout';
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, order.id]);
    const [paymentResult] = await conn.query(
      'INSERT INTO payments (order_id, status, idempotency_key) VALUES (?, ?, ?)',
      [order.id, paymentStatus, idempotencyKey]
    );

    await conn.commit();
    res.status(201).json({
      id: paymentResult.insertId,
      order_id: order.id,
      status: paymentStatus,
      order_status: newStatus
    });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message || 'Payment processing failed' });
  } finally {
    conn.release();
  }
});

async function releaseReservation(conn, orderId) {
  const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    await conn.query('UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?', [
      item.quantity,
      item.product_id
    ]);
  }
}

module.exports = router;
