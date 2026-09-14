const cron = require('node-cron');
const pool = require('../db');

/**
 * Runs every 30 seconds. Finds any order still "Reserved" whose 5-minute
 * hold has lapsed, releases the reserved stock back to available inventory,
 * and flips the order to "Expired". This is what guarantees stock isn't
 * held forever by an abandoned checkout.
 */
function startReservationExpiryJob() {
  cron.schedule('*/30 * * * * *', async () => {
<<<<<<< HEAD
    let conn;
    try {
      conn = await pool.getConnection();
=======
    const conn = await pool.getConnection();
    try {
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
      await conn.beginTransaction();
      const [expired] = await conn.query(
        `SELECT id FROM orders WHERE status = 'Reserved' AND expires_at < NOW() FOR UPDATE`
      );

      for (const { id } of expired) {
        const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
        for (const item of items) {
          await conn.query('UPDATE products SET reserved_stock = reserved_stock - ? WHERE id = ?', [
            item.quantity,
            item.product_id
          ]);
        }
        await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['Expired', id]);
      }

      await conn.commit();
      if (expired.length) {
        console.log(`[reservation-expiry] expired ${expired.length} order(s)`);
      }
    } catch (err) {
<<<<<<< HEAD
      if (conn) {
        try {
          await conn.rollback();
        } catch (_) {
          /* ignore */
        }
      }
      console.error('[reservation-expiry] job failed:', err.message);
    } finally {
      if (conn) conn.release();
=======
      await conn.rollback();
      console.error('[reservation-expiry] job failed:', err.message);
    } finally {
      conn.release();
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
    }
  });
}

module.exports = { startReservationExpiryJob };
