import { pool } from './server/config/database.js';

async function check() {
  try {
    for (const table of ['counties', 'facilities', 'auth_users']) {
      const r = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
        [table]
      );
      console.log(`\n${table}:`, r.rows.map(c => c.column_name).join(', '));
    }
    process.exit(0);
  } catch(e) { console.error(e.message); process.exit(1); }
}
check();
