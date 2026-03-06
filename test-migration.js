#!/usr/bin/env node
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

const queries = [
  { name: 'UUID Extension', sql: 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' },
  { name: 'Counties Table', sql: `CREATE TABLE IF NOT EXISTS counties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    region VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );` },
  { name: 'Facilities Table', sql: `CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    county_id UUID NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
    registration_number VARCHAR(100),
    facility_type VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    physical_address TEXT,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    is_active BOOLEAN DEFAULT TRUE,
    operational_status VARCHAR(50) DEFAULT 'active',
    database_credentials JSONB,
    api_key_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );` },
  { name: 'Facilities Index', sql: 'CREATE INDEX IF NOT EXISTS idx_facilities_county_id ON facilities(county_id);' }
];

async function test() {
  const client = await pool.connect();
  
  try {
    for (const query of queries) {
      console.log(`\n⏳ Testing: ${query.name}`);
      try {
        await client.query(query.sql);
        console.log(`✅ ${query.name} succeeded`);
      } catch (error) {
        console.log(`❌ ${query.name} failed`);
        console.error('   Error:', error.message);
        throw error;
      }
    }
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed at:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

test();
