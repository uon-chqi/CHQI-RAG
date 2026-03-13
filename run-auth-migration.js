import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add next_appointment_date to patients if missing
    const patCol = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='next_appointment_date'"
    );
    if (patCol.rows.length === 0) {
      await client.query('ALTER TABLE patients ADD COLUMN next_appointment_date DATE');
      console.log('+ Added patients.next_appointment_date');
    } else {
      console.log('  patients.next_appointment_date already exists');
    }

    // 2. Create auth_users table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'facility'
          CHECK (role IN ('super_admin', 'national', 'county', 'facility')),
        facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
        county_id UUID REFERENCES counties(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('+ auth_users table ready');

    // 3. Create indexes on auth_users
    await client.query('CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auth_users_facility ON auth_users(facility_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role)');
    console.log('+ auth_users indexes ready');

    // 4. Create index on patients appointment
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_appointment ON patients(next_appointment_date)');
    console.log('+ patients appointment index ready');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!');

    // Verify
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('auth_users','counties','facilities','patients') ORDER BY table_name"
    );
    console.log('Key tables:', tables.rows.map(r => r.table_name));

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
