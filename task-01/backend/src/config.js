require('dotenv').config();

const DEFAULT_DATABASE = 'techloom_pos';

function getDbConfig() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.MYSQL_PRIVATE_URL;
  const host = process.env.MYSQLHOST || process.env.DB_HOST;
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
  const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
  const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || DEFAULT_DATABASE;

  const poolOptions = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  // Prefer discrete vars (Railway private network) over a public proxy URL.
  if (host) {
    return { ...poolOptions, host, port, user, password, database };
  }
  if (url) {
    return { ...poolOptions, uri: url };
  }
  return {
    ...poolOptions,
    host: 'localhost',
    port,
    user,
    password,
    database
  };
}

module.exports = { getDbConfig, DEFAULT_DATABASE };
