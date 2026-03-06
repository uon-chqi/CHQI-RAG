#!/usr/bin/env node
/**
 * RBAC System Setup Script
 * Runs the migration and creates initial super admin user
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
    console.log('🔄 Starting RBAC migration...');
    
    // Read migration file
    let migration = readFileSync('./supabase/migrations/20260306_create_rbac_system_v2.sql', 'utf8');
    
    // Remove comments (lines starting with --)
    let cleanSQL = migration
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split by semicolon more carefully
    const statements = cleanSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      try {
        const preview = statements[i].substring(0, 60).replace(/\n/g, ' ');
        process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);
        
        await client.query(statements[i]);
        console.log('✅');
      } catch (error) {
        console.log(`❌ ${error.code}`);
        
        // Ignore certain errors
        if (error.code === '42P07' || error.code === '42710') {
          // "already exists"
          console.log('      (already exists, skipping)');
          continue;
        }
        
        throw error;
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verifying tables...');
    
    // Verify tables were created
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n✅ Tables created:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
  } catch (error) {
    console.error('\n\n❌ Migration failed:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Problem:', error.detail || 'Unknown');
    if (error.position) {
      console.error('Position:', error.position);
    }
    console.error('\nLast executed statement preview:');
    console.error(statements[statements.length - 1].substring(0, 200));
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

// Run migration
runMigration().then(() => {
  console.log('\n✨ RBAC system is ready!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
