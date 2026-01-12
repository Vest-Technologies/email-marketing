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
  console.log('Migration complete!');
}

migrate()
  .catch(console.error)
  .finally(() => process.exit(0));
