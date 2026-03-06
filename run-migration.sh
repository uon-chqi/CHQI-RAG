#!/bin/bash
# Run RBAC migration using psql

export PGPASSWORD=$DB_PASSWORD

psql -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  -p $DB_PORT \
  -f supabase/migrations/20260306_create_rbac_system_v2.sql

echo "✅ Migration completed!"
