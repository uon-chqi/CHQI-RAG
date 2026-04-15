import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

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
    // 1. Insert Siaya county if not exists
    const countyRes = await client.query(`
      INSERT INTO counties (name, code, is_active)
      VALUES ('Siaya', 'SYA', TRUE)
      ON CONFLICT (name) DO UPDATE SET is_active = TRUE
      RETURNING id, name
    `);
    const countyId = countyRes.rows[0].id;
    console.log('Siaya county:', countyId);

    // 2. Insert Othach Dispensary facility with MFL code 14000
    const facRes = await client.query(`
      INSERT INTO facilities (name, code, county_id, facility_type, operational_status, is_active)
      VALUES ('Othach Dispensary', '14000', $1, 'dispensary', 'operational', TRUE)
      ON CONFLICT ON CONSTRAINT facilities_email_unique DO NOTHING
      RETURNING id, name, code
    `, [countyId]);

    if (facRes.rows.length > 0) {
      console.log('Othach Dispensary created:', facRes.rows[0].id);
    } else {
      // May already exist by code, check
      const existing = await client.query(`SELECT id, name, code FROM facilities WHERE code = '14000'`);
      if (existing.rows.length > 0) {
        console.log('Othach Dispensary already exists:', existing.rows[0].id);
      } else {
        // No email conflict, try without ON CONFLICT
        const facRes2 = await client.query(`
          INSERT INTO facilities (name, code, county_id, facility_type, operational_status, is_active)
          VALUES ('Othach Dispensary', '14000', $1, 'dispensary', 'operational', TRUE)
          RETURNING id, name, code
        `, [countyId]);
        console.log('Othach Dispensary created:', facRes2.rows[0].id);
      }
    }

    // Verify
    const verify = await client.query(`
      SELECT f.id, f.name, f.code, c.name as county
      FROM facilities f
      LEFT JOIN counties c ON f.county_id = c.id
      WHERE f.code = '14000'
    `);
    console.log('Facility in DB:', verify.rows[0]);

    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
