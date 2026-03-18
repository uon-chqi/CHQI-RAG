import db from './server/config/database.js';

const tables = ['counties', 'facilities', 'documents', 'auth_users', 'patients', 'conversations'];
for (const t of tables) {
  try {
    const r = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`${t}: ${r.rows.map(c => c.column_name).join(', ')}`);
  } catch (e) {
    console.log(`${t}: TABLE NOT FOUND`);
  }
}
process.exit(0);
