// Runs schema.sql against the configured MySQL database.
// Usage: npm run migrate   (also runs automatically on server start)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { getDbConfig, DEFAULT_DATABASE } = require('./config');

const SEED_SQL = `
INSERT INTO products (name, description, category, price, stock) VALUES
  ('Cotton T-Shirt', 'Soft everyday cotton t-shirt', 'apparel', 12.99, 40),
  ('Running Shoes', 'Lightweight breathable running shoes', 'footwear', 59.99, 20),
  ('Bluetooth Speaker', 'Portable speaker with 12h battery', 'electronics', 29.99, 15),
  ('Ceramic Mug', 'Hand-glazed 350ml mug', 'home', 8.5, 30),
  ('Limited Drop Sneakers', 'Numbered limited edition release', 'footwear', 129.99, 3)
`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(connOpts, attempts = 30) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const connection = await mysql.createConnection(connOpts);
      await connection.query('SELECT 1');
      return connection;
    } catch (err) {
      lastErr = err;
      console.log(`Waiting for MySQL (${i}/${attempts}): ${err.message}`);
      await sleep(2000);
    }
  }
  throw lastErr || new Error('Could not connect to MySQL');
}

async function runMigrate() {
  const config = getDbConfig();
  const dbName = config.database || DEFAULT_DATABASE;

  const connOpts = config.uri
    ? { uri: config.uri, multipleStatements: true }
    : {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        multipleStatements: true
      };

  const connection = await connectWithRetry(connOpts);

  if (!config.uri && dbName) {
    try {
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    } catch (err) {
      console.warn(`CREATE DATABASE skipped: ${err.message}`);
    }
    await connection.query(`USE \`${dbName}\``);
  }

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await connection.query(sql);

  const [rows] = await connection.query('SELECT COUNT(*) AS c FROM products');
  if (Number(rows[0].c) === 0) {
    await connection.query(SEED_SQL);
    console.log('Seeded products');
  }

  console.log(`Migration complete. Database "${dbName}" is ready.`);
  await connection.end();
}

if (require.main === module) {
  runMigrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigrate };
