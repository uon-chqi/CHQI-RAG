import db from './server/config/database.js';
const r = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position");
r.rows.forEach(c => console.log(c.column_name.padEnd(28), c.data_type));
process.exit();
