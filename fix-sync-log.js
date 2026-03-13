import { pool } from './server/config/database.js';

try {
  const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='data_sync_log' ORDER BY ordinal_position`);
  console.log('data_sync_log columns:');
  r.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));

  const cols = r.rows.map(c => c.column_name);

  if (!cols.includes('synced_at')) {
    await pool.query('ALTER TABLE data_sync_log ADD COLUMN synced_at TIMESTAMPTZ DEFAULT NOW()');
    console.log('Added synced_at column');
  }
  if (!cols.includes('details')) {
    await pool.query('ALTER TABLE data_sync_log ADD COLUMN details JSONB');
    console.log('Added details column');
  }
  if (!cols.includes('data_hash')) {
    await pool.query('ALTER TABLE data_sync_log ADD COLUMN data_hash TEXT');
    console.log('Added data_hash column');
  }

  console.log('✅ data_sync_log table is ready');
  process.exit(0);
} catch(e) {
  console.error('Error:', e.message);
  process.exit(1);
}
