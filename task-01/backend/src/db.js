const mysql = require('mysql2/promise');
const { getDbConfig } = require('./config');

const pool = mysql.createPool(getDbConfig());

module.exports = pool;
