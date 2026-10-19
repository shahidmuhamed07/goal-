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

  // One check of Firebase login tokens serves both the admin and the app's own users.
  const verify = createFirebaseVerifier(env.FIREBASE_PROJECT_ID);
  const ownerEmails = parseEmails(env.ADMIN_EMAILS);
  const adminAuth = ownerEmails.length > 0 ? { verify, ownerEmails } : undefined;
  if (!adminAuth) {
    console.warn(
      env.NODE_ENV === 'production'
        ? 'ADMIN_EMAILS is empty: the admin is locked until you set it.'
        : 'ADMIN_EMAILS is empty: the admin is OPEN on this machine. Set it to test real login.',
    );
  }

  const app = createApp(store, {
    adminAuth,
    userAuth: verify,
    corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    isProduction: env.NODE_ENV === 'production',
  });

  const server = app.listen(env.PORT, () => {
    console.log(`API ready on http://localhost:${env.PORT}  (store: ${env.STORE}${env.STORE === 'mongo' ? `, database: ${env.MONGODB_DB}` : ', nothing is saved'}, admin login: ${adminAuth ? `on, ${ownerEmails.length} owner(s)` : 'off'})`);
  });

  // The most common start-up problem on a developer's computer: the API is already running somewhere else.
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\nPort ${env.PORT} is already in use: another copy of the API is probably running.`);
      console.error(`Stop it, or start this one on another port (for example PORT=${env.PORT + 1}), then try again.\n`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
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
