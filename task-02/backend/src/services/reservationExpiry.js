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
    let conn;
    try {
      conn = await pool.getConnection();
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
    }
  });
}

module.exports = { startReservationExpiryJob };
