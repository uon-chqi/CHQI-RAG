import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const sql = fs.readFileSync('migrate-kenyaemr-hl7-siu.sql', 'utf8');
    await pool.query(sql);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('patients', 'appointments', 'hl7_messages')
      ORDER BY table_name
    `);

    const appointmentColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `);

    console.log('KenyaEMR HL7 SIU migration completed.');
    console.log('Tables:', tables.rows.map((row) => row.table_name));
    console.log('Appointments columns:');
    appointmentColumns.rows.forEach((row) => {
      console.log(`  ${row.column_name} (${row.data_type})`);
    });
  } catch (error) {
    console.error('KenyaEMR HL7 SIU migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
