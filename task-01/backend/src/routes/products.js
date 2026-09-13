const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/products - list all products with live available stock
router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, price, stock, reserved_stock,
            (stock - reserved_stock) AS available_stock
     FROM products ORDER BY id`
  );
  res.json(rows);
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, price, stock, reserved_stock,
            (stock - reserved_stock) AS available_stock
     FROM products WHERE id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

// POST /api/products - create
router.post('/', async (req, res) => {
  const { name, price, stock } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: 'name, price and stock are required' });
  }
  const [result] = await pool.query(
    'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
    [name, price, stock]
  );
  res.status(201).json({ id: result.insertId, name, price, stock, reserved_stock: 0 });
});

// PUT /api/products/:id - update
router.put('/:id', async (req, res) => {
  const { name, price, stock } = req.body;
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Product not found' });

  await pool.query(
    'UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price), stock = COALESCE(?, stock) WHERE id = ?',
    [name ?? null, price ?? null, stock ?? null, req.params.id]
  );
  const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json(updated[0]);
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Product not found' });
  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

module.exports = router;
