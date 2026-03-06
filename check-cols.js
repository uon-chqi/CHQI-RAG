import db from './server/config/database.js';
const tables = ['user_roles', 'roles', 'counties'];
for (const t of tables) {
  const r = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`);
  console.log(`${t}:`, r.rows.map(x => x.column_name).join(', '));
}
process.exit();
