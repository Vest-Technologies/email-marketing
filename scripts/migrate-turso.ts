import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log('Running migrations...');

  // Create Settings table if it doesn't exist
  await client.execute(`
    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      senderEmail TEXT,
      senderName TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Settings table created/verified.');

  // Create FetchedOrganization table if it doesn't exist (for tracking imported Apollo organizations)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS FetchedOrganization (
      id TEXT PRIMARY KEY,
      apolloId TEXT UNIQUE NOT NULL,
      domain TEXT,
      name TEXT,
      fetchedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for FetchedOrganization
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_fetched_org_apolloId ON FetchedOrganization(apolloId)
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_fetched_org_domain ON FetchedOrganization(domain)
  `);

  console.log('FetchedOrganization table created/verified.');
  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0));
