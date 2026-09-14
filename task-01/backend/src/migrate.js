// Runs schema.sql against the configured MySQL database.
<<<<<<< HEAD
// Usage: npm run migrate   (also runs automatically on server start)
=======
// Usage: npm run migrate
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
<<<<<<< HEAD
const { getDbConfig, DEFAULT_DATABASE } = require('./config');

const SEED_SQL = `
INSERT INTO products (name, price, stock) VALUES
  ('Wireless Mouse', 9.99, 25),
  ('Mechanical Keyboard', 49.99, 10),
  ('USB-C Hub', 19.99, 15),
  ('Limited Edition Sticker Pack', 4.99, 3)
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
=======

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  const dbName = process.env.DB_NAME || 'techloom_pos';
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await connection.query(sql);

<<<<<<< HEAD
  const [rows] = await connection.query('SELECT COUNT(*) AS c FROM products');
  if (Number(rows[0].c) === 0) {
    await connection.query(SEED_SQL);
    console.log('Seeded products');
  }

=======
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
  console.log(`Migration complete. Database "${dbName}" is ready.`);
  await connection.end();
}

<<<<<<< HEAD
if (require.main === module) {
  runMigrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runMigrate };
=======
migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b
