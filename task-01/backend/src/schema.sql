-- Task 01: POS Order & Inventory System
-- MySQL schema

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,        -- total physical stock
  reserved_stock INT NOT NULL DEFAULT 0, -- stock currently held by Reserved orders
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- available stock for sale = stock - reserved_stock

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status ENUM('Pending','Reserved','Paid','Cancelled','Expired','Failed') NOT NULL DEFAULT 'Pending',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  idempotency_key VARCHAR(100) UNIQUE, -- prevents duplicate order/checkout submission
  reserved_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,           -- reservation expiry (reserved_at + 5 min)
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
  idempotency_key VARCHAR(100) UNIQUE, -- prevents duplicate payment submission for same attempt
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Order status transition table (enforced in application layer, documented here):
-- Pending   -> Reserved (checkout)
-- Reserved  -> Paid      (payment success)
-- Reserved  -> Failed    (payment failure)
-- Reserved  -> Expired   (5 min timeout, no payment attempt / payment timeout)
-- Reserved  -> Cancelled (user cancels before paying)
-- Paid      -> Cancelled (user cancels after paying -> refund simulated)
-- All other transitions are rejected by the API.
<<<<<<< HEAD
-- Seed data is inserted by migrate.js only when the products table is empty.
=======

INSERT INTO products (name, price, stock) VALUES
  ('Wireless Mouse', 9.99, 25),
  ('Mechanical Keyboard', 49.99, 10),
  ('USB-C Hub', 19.99, 15),
  ('Limited Edition Sticker Pack', 4.99, 3)
ON DUPLICATE KEY UPDATE name = name;
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
