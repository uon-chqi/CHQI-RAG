import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // 1. Check existing constraints
  const constraints = await pool.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name IN ('counties','facilities','auth_users')
      AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
    ORDER BY tc.table_name, tc.constraint_name
  `);
  console.log('Existing constraints:');
  console.table(constraints.rows);

  // 2. Add missing unique constraints
  const fixes = [
    { table: 'counties', col: 'name', constraint: 'counties_name_unique' },
    { table: 'facilities', col: 'email', constraint: 'facilities_email_unique' },
    { table: 'auth_users', col: 'email', constraint: 'auth_users_email_unique' },
  ];

  for (const fix of fixes) {
    // Check if constraint already exists
    const exists = constraints.rows.some(
      r => r.table_name === fix.table && r.column_name === fix.col && r.constraint_type === 'UNIQUE'
    );
    if (exists) {
      console.log(`✅ ${fix.table}.${fix.col} UNIQUE constraint already exists`);
    } else {
      try {
        await pool.query(`ALTER TABLE ${fix.table} ADD CONSTRAINT ${fix.constraint} UNIQUE (${fix.col})`);
        console.log(`✅ Added UNIQUE constraint on ${fix.table}.${fix.col}`);
      } catch (err) {
        if (err.code === '23505') {
          // Duplicate values exist — need to deduplicate first
          console.log(`⚠️  Duplicate values in ${fix.table}.${fix.col}, deduplicating...`);
          // Keep the first row, delete later duplicates
          await pool.query(`
            DELETE FROM ${fix.table} WHERE id NOT IN (
              SELECT MIN(id) FROM ${fix.table} GROUP BY ${fix.col}
            )
          `);
          await pool.query(`ALTER TABLE ${fix.table} ADD CONSTRAINT ${fix.constraint} UNIQUE (${fix.col})`);
          console.log(`✅ Deduplicated and added UNIQUE constraint on ${fix.table}.${fix.col}`);
        } else {
          console.error(`❌ Error on ${fix.table}.${fix.col}:`, err.message);
        }
      }
    }
  }

  // 3. Verify
  const after = await pool.query(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name IN ('counties','facilities','auth_users')
      AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
    ORDER BY tc.table_name, tc.constraint_name
  `);
  console.log('\nFinal constraints:');
  console.table(after.rows);

  await pool.end();
  console.log('\n✅ Done!');
}

run().catch(err => { console.error(err); process.exit(1); });
