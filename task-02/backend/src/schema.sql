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
<<<<<<< HEAD
-- Seed data is inserted by migrate.js only when the products table is empty.
=======

INSERT INTO products (name, description, category, price, stock) VALUES
  ('Cotton T-Shirt', 'Soft everyday cotton t-shirt', 'apparel', 12.99, 40),
  ('Running Shoes', 'Lightweight breathable running shoes', 'footwear', 59.99, 20),
  ('Bluetooth Speaker', 'Portable speaker with 12h battery', 'electronics', 29.99, 15),
  ('Ceramic Mug', 'Hand-glazed 350ml mug', 'home', 8.5, 30),
  ('Limited Drop Sneakers', 'Numbered limited edition release', 'footwear', 129.99, 3)
ON DUPLICATE KEY UPDATE name = name;
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
