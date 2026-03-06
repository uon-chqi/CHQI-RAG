#!/usr/bin/env node
import { readFileSync } from 'fs';

let migration = readFileSync('./supabase/migrations/20260306_create_rbac_system_v2.sql', 'utf8');

// Remove comments (lines starting with --)
let cleanSQL = migration
  .split('\n')
  .filter(line => !line.trim().startsWith('--'))
  .join('\n');

// Split by semicolon
const statements = cleanSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0);

console.log('Total statements:', statements.length);
console.log('\n===============');
console.log('STATEMENT 5:');
console.log('===============');
console.log(statements[4]);
console.log('\n===============');
console.log('STATEMENT 6:');
console.log('===============');
console.log(statements[5]);
