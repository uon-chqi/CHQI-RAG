#!/usr/bin/env node
/**
 * RBAC Migration - Drop and Recreate
 * Cleans up old schema and installs new RBAC system
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 RBAC Migration Started\n');
    
    // Step 1: Drop old RBAC tables if they exist
console.log('🗑️  Dropping old RBAC tables...');
    const dropQueries = [
      'DROP TABLE IF EXISTS data_sync_log CASCADE;',
      'DROP TABLE IF EXISTS facility_data_audit CASCADE;',
      'DROP TABLE IF EXISTS patient_ccc_numbers CASCADE;',
      'DROP TABLE IF EXISTS patients CASCADE;',
      'DROP TABLE IF EXISTS user_roles CASCADE;',
      'DROP TABLE IF EXISTS role_permissions CASCADE;',
      'DROP TABLE IF EXISTS permissions CASCADE;',
      'DROP TABLE IF EXISTS roles CASCADE;',
      'DROP TABLE IF EXISTS facilities CASCADE;',
      'DROP TABLE IF EXISTS counties CASCADE;'
    ];
    
    for (const query of dropQueries) {
      try {
        await client.query(query);
        console.log('   ✓', query.substring(11, 40));
      } catch (e) {
        // Ignore errors if tables don't exist
      }
    }
    
    console.log('\n✅ Old tables dropped\n');
    
    // Step 2: Enable required extensions
    console.log('⚙️  Enabling extensions...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      console.log('   ✓ uuid-ossp extension enabled');
    } catch (e) {
      console.log('   ⚠️  uuid-ossp extension:', e.message);
    }
    
    console.log('\n📝 Creating RBAC schema...\n');
    
    // Step 3: Execute migration file
    const sqlFile = readFileSync('./supabase/migrations/20260306_create_rbac_system_v2.sql', 'utf8');
    const statements = sqlFile
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    let count = 0;
    for (const sql of statements) {
      try {
        await client.query(sql);
        count++;
      } catch (error) {
        if (error.code === '42P07' || error.code === '42710') {
          // Already exists - skip
          count++;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`✅ Executed ${count} SQL statements\n`);
    
    // Step 4: Verify
    console.log('📊 Verifying tables...\n');
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    const rbacTables = [
      'counties', 'facilities', 'roles', 'permissions',
      'role_permissions', 'users', 'user_roles', 'patients',
      'patient_ccc_numbers', 'facility_data_audit', 'data_sync_log'
    ];
    
    const createdTables = result.rows.map(r => r.table_name);
    rbacTables.forEach(table => {
      if (createdTables.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} (missing!)`);
      }
    });
    
    console.log(`\n✨ Migration complete! ${createdTables.length} tables total`);
    
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

migrate().then(() => {
  console.log('\n🎉 RBAC system successfully installed!');
  process.exit(0);
});
