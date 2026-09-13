const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/products?search=shoe&category=footwear&minPrice=10&maxPrice=100&inStockOnly=true
router.get('/', async (req, res) => {
  const { search, category, minPrice, maxPrice, inStockOnly } = req.query;
  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (minPrice) {
    clauses.push('price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    clauses.push('price <= ?');
    params.push(Number(maxPrice));
  }
  if (inStockOnly === 'true') {
    clauses.push('(stock - reserved_stock) > 0');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, name, description, category, price, stock, reserved_stock,
            (stock - reserved_stock) AS available_stock
     FROM products ${where} ORDER BY id`,
    params
  );
  res.json(rows);
});

// GET /api/products/categories - distinct categories for filter UI
router.get('/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
  res.json(rows.map((r) => r.category));
});

// GET /api/products/:id - product details view
router.get('/:id', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, description, category, price, stock, reserved_stock,
            (stock - reserved_stock) AS available_stock
     FROM products WHERE id = ?`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Product not found' });
  res.json(rows[0]);
});

module.exports = router;
