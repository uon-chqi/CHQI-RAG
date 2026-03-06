#!/usr/bin/env node
/**
 * Seed Script - Creates initial RBAC data:
 * - Super admin user
 * - A county
 * - A facility
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

// Simple password hasher using crypto (no bcrypt needed at this step)
function hashPassword(password) {
  return createHash('sha256').update(password + 'chqi_salt_2026').digest('hex');
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding initial RBAC data...\n');

    // ─────────────────────────────────────────
    // 1. Create County
    // ─────────────────────────────────────────
    console.log('📍 Creating county...');
    const countyResult = await client.query(`
      INSERT INTO counties (name, code, region, description)
      VALUES ('Nairobi', 'NBI', 'Central', 'Nairobi County - Capital')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code
    `);
    const county = countyResult.rows[0];
    console.log(`   ✅ County: ${county.name} (${county.code}) — ID: ${county.id}`);

    // ─────────────────────────────────────────
    // 2. Create Facility
    // ─────────────────────────────────────────
    console.log('\n🏥 Creating facility...');
    const facilityResult = await client.query(`
      INSERT INTO facilities (name, code, county_id, facility_type, phone, email, physical_address, is_active)
      VALUES ('Kenyatta National Hospital', 'KNH-001', $1, 'hospital', '+254700000001', 'admin@knh.go.ke', 'Hospital Rd, Nairobi', TRUE)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code
    `, [county.id]);
    const facility = facilityResult.rows[0];
    console.log(`   ✅ Facility: ${facility.name} (${facility.code}) — ID: ${facility.id}`);

    // ─────────────────────────────────────────
    // 3. Create Super Admin User
    // ─────────────────────────────────────────
    console.log('\n👤 Creating super admin user...');
    const passwordHash = hashPassword('Admin@1234!');
    const userResult = await client.query(`
      INSERT INTO users (email, first_name, last_name, phone, password_hash, job_title, is_active)
      VALUES ('superadmin@chqi.go.ke', 'Super', 'Admin', '+254700000000', $1, 'System Administrator', TRUE)
      ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id, email, first_name, last_name
    `, [passwordHash]);
    const user = userResult.rows[0];
    console.log(`   ✅ User: ${user.first_name} ${user.last_name} <${user.email}> — ID: ${user.id}`);

    // ─────────────────────────────────────────
    // 4. Assign super_admin role to user
    // ─────────────────────────────────────────
    console.log('\n🔑 Assigning super_admin role...');
    const roleResult = await client.query(`SELECT id FROM roles WHERE name = 'super_admin'`);
    if (roleResult.rows.length > 0) {
      const roleId = roleResult.rows[0].id;
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role_id, facility_id, county_id) DO NOTHING
      `, [user.id, roleId]);
      console.log(`   ✅ Role 'super_admin' assigned`);
    } else {
      console.log('   ⚠️  super_admin role not found - run migrate first');
    }

    // ─────────────────────────────────────────
    // 5. Create Facility Admin User
    // ─────────────────────────────────────────
    console.log('\n👤 Creating facility admin user...');
    const fadminResult = await client.query(`
      INSERT INTO users (email, first_name, last_name, phone, password_hash, job_title, is_active)
      VALUES ('fadmin@knh.go.ke', 'Facility', 'Admin', '+254700000002', $1, 'Facility Administrator', TRUE)
      ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
      RETURNING id, email
    `, [passwordHash]);
    const fadmin = fadminResult.rows[0];

    const fadminRoleResult = await client.query(`SELECT id FROM roles WHERE name = 'facility_admin'`);
    if (fadminRoleResult.rows.length > 0) {
      await client.query(`
        INSERT INTO user_roles (user_id, role_id, facility_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, role_id, facility_id, county_id) DO NOTHING
      `, [fadmin.id, fadminRoleResult.rows[0].id, facility.id]);
    }
    console.log(`   ✅ Facility admin: ${fadmin.email}`);

    // ─────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('✨ Seeding complete!');
    console.log('═══════════════════════════════════════════');
    console.log('\n📋 Login Credentials:');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│ Super Admin:                            │');
    console.log('│   Email   : superadmin@chqi.go.ke       │');
    console.log('│   Password: Admin@1234!                 │');
    console.log('├─────────────────────────────────────────┤');
    console.log('│ Facility Admin (KNH):                   │');
    console.log('│   Email   : fadmin@knh.go.ke            │');
    console.log('│   Password: Admin@1234!                 │');
    console.log('└─────────────────────────────────────────┘');
    console.log('\n📍 County  : Nairobi (NBI)');
    console.log('🏥 Facility: Kenyatta National Hospital (KNH-001)');

  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

seed();
