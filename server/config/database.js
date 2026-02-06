import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

const dbName = process.env.DB_NAME;
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

if (!dbName || !dbHost || !dbPort || !dbUser || !dbPassword) {
  throw new Error(
    'Missing database environment variables. Required: DB_NAME, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD'
  );
}

export const pool = new Pool({
  database: dbName,
  host: dbHost,
  port: Number(dbPort),
  user: dbUser,
  password: dbPassword,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', { text, error: error.message });
    throw error;
  }
};
