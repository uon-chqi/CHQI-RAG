# PostgreSQL Database Setup Guide

This guide will help you set up a PostgreSQL database for the Healthcare RAG System using Aiven or any other PostgreSQL provider.

## Option 1: Using Aiven (Recommended)

Aiven provides managed PostgreSQL databases with automatic backups, monitoring, and scaling.

### Step 1: Create an Aiven Account

1. Go to [https://aiven.io](https://aiven.io)
2. Sign up for a free account
3. Verify your email address

### Step 2: Create a PostgreSQL Service

1. Log in to the Aiven Console
2. Click **"Create Service"**
3. Select **PostgreSQL** as the service type
4. Choose your preferred:
   - **Cloud Provider**: AWS, Google Cloud, or Azure
   - **Region**: Choose one close to your users
   - **Service Plan**:
     - **Free tier** (Hobbyist) for development/testing
     - **Startup** or higher for production
5. Give your service a name (e.g., `healthcare-rag-db`)
6. Click **"Create Service"**
7. Wait 5-10 minutes for the service to be created

### Step 3: Get Your Connection String

1. Once the service is running, click on it
2. Go to the **"Overview"** tab
3. Find the **"Connection Information"** section
4. Copy the **"Service URI"** (this is your `DATABASE_URL`)
5. It should look like this:
   ```
   postgres://username:password@hostname:port/defaultdb?sslmode=require
   ```

### Step 4: Configure Your Application

1. Open the `.env` file in your project root
2. Replace `your_postgresql_connection_string_here` with your Aiven connection string:
   ```env
   DATABASE_URL=postgres://avnadmin:your_password@your-service.aivencloud.com:12345/defaultdb?sslmode=require
   ```

### Step 5: Run the Database Schema

1. Connect to your Aiven database using any PostgreSQL client:
   - **psql** (command line)
   - **pgAdmin** (GUI)
   - **DBeaver** (GUI)
   - **TablePlus** (GUI)

2. Using psql (from command line):
   ```bash
   psql "postgres://avnadmin:your_password@your-service.aivencloud.com:12345/defaultdb?sslmode=require"
   ```

3. Once connected, run the schema file:
   ```sql
   \i database-schema.sql
   ```

   Or copy and paste the contents of `database-schema.sql` into your SQL client.

4. Verify the tables were created:
   ```sql
   \dt
   ```
   You should see: `conversations`, `documents`, `sessions`, `system_health`, `analytics_daily`

---

## Option 2: Using Other PostgreSQL Providers

You can use any PostgreSQL provider. Here are some popular options:

### Render (https://render.com)
- Free tier available
- Automatic backups on paid plans
- Similar setup to Aiven

### Supabase (Database Only)
- Free tier with 500MB storage
- Built-in connection pooling
- Note: We're only using their PostgreSQL database, not their SDK

### DigitalOcean Managed Databases
- Starting at $15/month
- Automatic backups
- Multiple node options

### AWS RDS
- Pay-as-you-go pricing
- Highly scalable
- Requires more setup

### Railway (https://railway.app)
- Free tier with $5 credit/month
- Simple setup
- Great for development

### Setup Steps (General for Any Provider):

1. Create a PostgreSQL database instance
2. Get the connection string (should look like):
   ```
   postgresql://username:password@host:port/database
   ```
3. Add `?sslmode=require` to the end if SSL is required
4. Add the connection string to your `.env` file
5. Run the `database-schema.sql` script on your database

---

## Option 3: Local PostgreSQL (Development Only)

For local development, you can install PostgreSQL on your machine.

### macOS (using Homebrew):
```bash
brew install postgresql@15
brew services start postgresql@15
createdb healthcare_rag
```

Your connection string:
```env
DATABASE_URL=postgresql://localhost:5432/healthcare_rag
```

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb healthcare_rag
sudo -u postgres createuser your_username -P
```

Your connection string:
```env
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/healthcare_rag
```

### Windows:
1. Download PostgreSQL from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Use pgAdmin (included) to create a database named `healthcare_rag`

Your connection string:
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/healthcare_rag
```

### Running the Schema:
```bash
psql $DATABASE_URL -f database-schema.sql
```

---

## Verifying Your Setup

Once you've configured your database, verify it's working:

### 1. Test Database Connection

Create a test file `test-db.js`:
```javascript
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
    console.log('Server time:', result.rows[0].now);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log('📊 Tables found:', tables.rows.map(r => r.table_name));

    await pool.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();
```

Run it:
```bash
node test-db.js
```

### 2. Start Your Application

```bash
# Start the backend server
npm run server

# In another terminal, start the frontend
npm run dev
```

### 3. Check the System Health Page

1. Open your browser to `http://localhost:5173`
2. Navigate to the "System Health" page
3. All services should show their status

---

## Troubleshooting

### Error: "connection refused"
- Check if your DATABASE_URL is correct
- Verify the database service is running
- Check your firewall settings

### Error: "SSL connection required"
- Add `?sslmode=require` to your connection string
- For Aiven, SSL is always required

### Error: "relation does not exist"
- You haven't run the database schema yet
- Run `database-schema.sql` on your database

### Error: "password authentication failed"
- Double-check your connection string
- Verify username and password are correct
- Make sure there are no special characters causing issues (URL encode if needed)

### Connection Pooling Issues
- The application uses connection pooling (max 20 connections)
- For production, you may need to adjust `pool.max` in `server/config/database.js`

---

## Security Best Practices

1. **Never commit your .env file** - It's in `.gitignore` by default
2. **Use environment variables** - Don't hardcode credentials
3. **Enable SSL** - Always use SSL for remote databases
4. **Restrict IP access** - In Aiven/production, whitelist only your server IPs
5. **Regular backups** - Enable automatic backups in your database provider
6. **Use read replicas** - For high-traffic production environments
7. **Monitor queries** - Use your provider's monitoring tools

---

## Database Maintenance

### Backing Up (Aiven)
Aiven automatically backs up your database. You can also create manual backups:
1. Go to your service in Aiven Console
2. Click "Backups" tab
3. Click "Create backup"

### Backing Up (Manual)
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Restoring from Backup
```bash
psql $DATABASE_URL < backup-20240206.sql
```

### Monitoring Performance
- Check slow queries in your provider's dashboard
- Monitor connection pool usage
- Set up alerts for high CPU/memory usage

---

## Migration to Production

When moving to production:

1. **Use a production-grade database plan**
   - At least 2GB RAM
   - Automated backups
   - High availability (optional)

2. **Update your connection string**
   - Use the production DATABASE_URL
   - Enable connection pooling

3. **Set up monitoring**
   - Database performance metrics
   - Query performance
   - Connection pool status

4. **Configure backups**
   - Daily automated backups
   - Retention period of 7-30 days
   - Test restore procedures

5. **Security hardening**
   - Restrict IP access
   - Use strong passwords
   - Enable audit logging

---

## Need Help?

- **Aiven Documentation**: [https://docs.aiven.io/docs/products/postgresql](https://docs.aiven.io/docs/products/postgresql)
- **PostgreSQL Documentation**: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **Connection Issues**: Check your `.env` file and verify the database is running

---

## Next Steps

After setting up PostgreSQL:

1. Configure other environment variables (Gemini, Pinecone, SMS, WhatsApp)
2. Start the application with `npm run server` and `npm run dev`
3. Upload medical documents via the dashboard
4. Test SMS/WhatsApp integrations
5. Monitor system health and analytics
