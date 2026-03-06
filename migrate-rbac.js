#!/usr/bin/env node
/**
 * Simple RBAC Migration Script
 * Sends the entire SQL file to PostgreSQL
 */

import { readFileSync } from 'fs';
import { Pool } from 'pg';
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

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting RBAC migration...\n');
    
    // Read the entire migration file
    const sqlFile = readFileSync('./supabase/migrations/20260306_create_rbac_system_v2.sql', 'utf8');
    
    console.log('📝 Executing SQL migration...');
    
    // Execute the entire file at once
    await client.query(sqlFile);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables
    console.log('📊 Verifying tables created...\n');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('✅ Tables:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log(`\n📈 Total tables created: ${result.rows.length}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error Code:', error.code);
    console.error('Error:', error.message);
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    if (error.context) {
      console.error('Context:', error.context);
    }
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

runMigration().then(() => {
  console.log('\n✨ RBAC system ready!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
