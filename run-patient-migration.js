import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

const { Pool } = pkg;
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync('migrate-patients-upload.sql', 'utf-8');
    // Split by semicolons, ignore comments-only blocks
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.match(/^--/m) && s.replace(/--[^\n]*/g, '').trim());

    for (const stmt of statements) {
      const clean = stmt.replace(/--[^\n]*/g, '').trim();
      if (!clean) continue;
      const preview = clean.substring(0, 80).replace(/\n/g, ' ');
      console.log(`Running: ${preview}...`);
      await client.query(clean);
      console.log('  OK');
    }

    // Verify
    const res = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position`
    );
    console.log('\nPatients table columns after migration:');
    res.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    console.log(`\nTotal columns: ${res.rows.length}`);
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
