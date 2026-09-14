<<<<<<< HEAD
const mysql = require('mysql2/promise');
const { getDbConfig } = require('./config');

const pool = mysql.createPool(getDbConfig());
=======
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'techloom_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});
>>>>>>> c8e52bbd3c97e09a7f2cfafcb9e9f9787748df3b

module.exports = pool;
