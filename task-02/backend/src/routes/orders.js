const express = require('express');
const router = express.Router();
const pool = require('../db');

const RESERVATION_MINUTES = parseInt(process.env.RESERVATION_MINUTES || '5', 10);

// GET /api/orders?customer=Name - order history
router.get('/', async (req, res) => {
  const { customer } = req.query;
  const where = customer ? 'WHERE customer_name = ?' : '';
  const params = customer ? [customer] : [];
  const [orders] = await pool.query(`SELECT * FROM orders ${where} ORDER BY id DESC`, params);
  const [items] = await pool.query(
    `SELECT oi.*, p.name AS product_name FROM order_items oi JOIN products p ON p.id = oi.product_id`
  );
  const byOrder = {};
  items.forEach((it) => {
    byOrder[it.order_id] = byOrder[it.order_id] || [];
    byOrder[it.order_id].push(it);
  });
  res.json(orders.map((o) => ({ ...o, items: byOrder[o.id] || [] })));
});

router.get('/:id', async (req, res) => {
  const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!orders.length) return res.status(404).json({ error: 'Order not found' });
  const [items] = await pool.query(
    `SELECT oi.*, p.name AS product_name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
    [req.params.id]
  );
  const [refunds] = await pool.query('SELECT * FROM refunds WHERE order_id = ?', [req.params.id]);
  res.json({ ...orders[0], items, refunds });
});

/**
 * POST /api/checkout
 * Body: { customerName, items: [{ productId, quantity }], idempotencyKey }
 * Reserves stock for every cart item inside one transaction, row-locking each
 * product so simultaneous checkouts on the same item can't oversell it.
 */
router.post('/checkout', async (req, res) => {
  const { customerName, items, idempotencyKey } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required' });
  }
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'idempotencyKey is required to prevent duplicate orders' });
  }

  const [existing] = await pool.query('SELECT id FROM orders WHERE idempotency_key = ?', [idempotencyKey]);
  if (existing.length) {
    const [order] = await pool.query('SELECT * FROM orders WHERE id = ?', [existing[0].id]);
    return res.status(200).json({ ...order[0], deduplicated: true });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    const lockedProducts = [];
    const sortedItems = [...items].sort((a, b) => a.productId - b.productId);

    for (const item of sortedItems) {
      const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
      if (!rows.length) throw { status: 404, message: `Product ${item.productId} not found` };
      const product = rows[0];
      const available = product.stock - product.reserved_stock;
      if (item.quantity <= 0) throw { status: 400, message: 'Quantity must be positive' };
      if (available < item.quantity) {
        throw { status: 409, message: `Insufficient stock for "${product.name}". Available: ${available}` };
      }
      lockedProducts.push({ product, quantity: item.quantity });
      total += Number(product.price) * item.quantity;
    }

    const reservedAt = new Date();
    const expiresAt = new Date(reservedAt.getTime() + RESERVATION_MINUTES * 60 * 1000);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_name, status, total, idempotency_key, reserved_at, expires_at)
       VALUES (?, 'Reserved', ?, ?, ?, ?)`,
      [customerName || 'Guest', total, idempotencyKey, reservedAt, expiresAt]
    );
    const orderId = orderResult.insertId;

    for (const { product, quantity } of lockedProducts) {
      await conn.query('UPDATE products SET reserved_stock = reserved_stock + ? WHERE id = ?', [
        quantity,
        product.id
      ]);
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, product.id, quantity, product.price]
      );
    }

    await conn.commit();
    const [order] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(order[0]);
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message || 'Checkout failed' });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/orders/:id/cancel
 * Reserved -> Cancelled: releases the stock hold, no charge was ever made
 * Paid     -> Refunded : simulates a refund, restores stock, logs a refund record
 */
router.post('/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!orders.length) throw { status: 404, message: 'Order not found' };
    const order = orders[0];

    if (!['Reserved', 'Paid'].includes(order.status)) {
      throw { status: 409, message: `Cannot cancel an order in "${order.status}" status` };
    }

    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    let newStatus;

    if (order.status === 'Reserved') {
      for (const item of items) {
        await conn.query('UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?', [
          item.quantity,
          item.product_id
        ]);
      }
      newStatus = 'Cancelled';
    } else {
      // Paid -> simulate refund
      for (const item of items) {
        await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
      await conn.query('INSERT INTO refunds (order_id, amount, reason) VALUES (?, ?, ?)', [
        order.id,
        order.total,
        'Order cancelled after payment'
      ]);
      newStatus = 'Refunded';
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, order.id]);
    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    res.json(updated[0]);
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ error: err.message || 'Cancel failed' });
  } finally {
    conn.release();
  }
});

module.exports = router;
