import dotenv from 'dotenv'; dotenv.config();
import pkg from 'pg'; const { Pool } = pkg;
const p = new Pool({ database: process.env.DB_NAME, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

const r = await p.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='patients' ORDER BY ordinal_position");
console.log('=== PATIENTS TABLE ===');
console.table(r.rows);

const c = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='conversations' ORDER BY ordinal_position");
console.log('=== CONVERSATIONS TABLE ===');
console.table(c.rows);

// Check if conversations has facility_id
const hasFacCol = c.rows.some(row => row.column_name === 'facility_id');
console.log('conversations.facility_id exists:', hasFacCol);

// Check if data_sync_log table exists
const syncTable = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='data_sync_log' ORDER BY ordinal_position");
console.log('=== DATA_SYNC_LOG TABLE ===');
console.table(syncTable.rows);

await p.end();
