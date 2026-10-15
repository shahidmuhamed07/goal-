import { createFirebaseVerifier, parseEmails } from './auth';
import { loadEnv } from './env';
import { createApp } from './app';
import { MemoryStore } from './memoryStore';
import { MongoStore } from './mongoStore';
import type { ContentStore } from './store';

async function main() {
  const env = loadEnv();

  const store: ContentStore = env.STORE === 'mongo' ? new MongoStore(env.MONGODB_URI!, env.MONGODB_DB) : new MemoryStore();
  try {
    await store.ready();
  } catch (e) {
    console.error('\nCould not connect to the database.');
    console.error('Common causes: wrong password, special characters in the password not URL-encoded,');
    console.error('or your IP address is not allowed under Atlas → Network Access.\n');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const allowedEmails = parseEmails(env.ADMIN_EMAILS);
  const adminAuth = allowedEmails.length > 0 ? { verify: createFirebaseVerifier(env.FIREBASE_PROJECT_ID), allowedEmails } : undefined;
  if (!adminAuth) {
    console.warn(
      env.NODE_ENV === 'production'
        ? 'ADMIN_EMAILS is empty: the admin is locked until you set it.'
        : 'ADMIN_EMAILS is empty: the admin is OPEN on this machine. Set it to test real login.',
    );
  }

  const app = createApp(store, {
    adminAuth,
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    isProduction: env.NODE_ENV === 'production',
  });

  const server = app.listen(env.PORT, () => {
    console.log(`API ready on http://localhost:${env.PORT}  (store: ${env.STORE}${env.STORE === 'mongo' ? `, database: ${env.MONGODB_DB}` : ', nothing is saved'}, admin login: ${adminAuth ? `on for ${allowedEmails.length} email(s)` : 'off'})`);
  });

  const stop = async () => {
    server.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
