-- Task 02: E-Commerce Checkout & Payment System
-- MySQL schema

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  reserved_stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- available stock for sale = stock - reserved_stock

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL DEFAULT 'Guest',
  status ENUM('Pending','Reserved','Paid','Cancelled','Expired','Failed','Refunded') NOT NULL DEFAULT 'Pending',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(100) UNIQUE,
  reserved_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status ENUM('Success','Failed','Timeout') NOT NULL,
  idempotency_key VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) DEFAULT 'Order cancelled after payment',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Status transitions (enforced in application layer):
-- Pending  -> Reserved  (checkout, stock reserved)
-- Reserved -> Paid      (payment success)
-- Reserved -> Failed    (payment failure, stock released)
-- Reserved -> Expired   (5 min timeout / payment timeout, stock released)
-- Reserved -> Cancelled (user cancels before paying, stock released)
-- Paid     -> Refunded  (user cancels after paying, refund simulated, stock restored)
-- Seed data is inserted by migrate.js only when the products table is empty.
