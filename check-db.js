import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const p = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // List tables
    const tables = await p.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('=== TABLES ===');
    console.log(tables.rows.map(r => r.table_name));

    // Check patients columns
    const patCols = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='patients' ORDER BY ordinal_position");
    console.log('\n=== PATIENTS COLUMNS ===');
    console.log(patCols.rows);

    // Check facilities columns
    const facCols = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='facilities' ORDER BY ordinal_position");
    console.log('\n=== FACILITIES COLUMNS ===');
    console.log(facCols.rows);

    // Check if conversations exists
    const convCols = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='conversations' ORDER BY ordinal_position");
    console.log('\n=== CONVERSATIONS COLUMNS ===');
    console.log(convCols.rows.map(r => r.column_name));

  } catch (e) {
    console.error(e.message);
  }
  p.end();
}
run();
