import { MongoClient } from 'mongodb';
import { loadEnv } from './env';

/**
 * `npm run db:check`: answers one question, "can this computer reach the database?".
 * It prints what it finds but never the connection string or the password.
 */
async function main() {
  const env = loadEnv({ ...process.env, STORE: 'mongo' });
  const host = env.MONGODB_URI!.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, '').split(/[/?]/)[0];
  console.log(`Trying to reach ${host} …`);

  const client = new MongoClient(env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    const db = client.db(env.MONGODB_DB);
    const collections = await db.listCollections().toArray();
    console.log(`Connected. Database "${env.MONGODB_DB}" has ${collections.length} collection(s).`);

    // Prove we can write and clean up after ourselves.
    const probe = db.collection('_connection_check');
    await probe.insertOne({ at: new Date() });
    await probe.drop();
    console.log('Write test passed (a temporary record was created and removed).');
  } catch (e) {
    console.error('\nCould not connect.');
    const msg = e instanceof Error ? e.message : String(e);
    if (/bad auth|authentication failed/i.test(msg)) {
      console.error('The username or password is wrong, or the password has special characters that are not URL-encoded (for example "@" must be "%40").');
    } else if (/ENOTFOUND|querySrv|getaddrinfo/i.test(msg)) {
      console.error('The address in the connection string cannot be found. Check the part after "@" (the cluster host).');
    } else if (/timed out|Server selection|ECONNREFUSED|ReplicaSetNoPrimary|ssl|tls/i.test(msg)) {
      console.error('Atlas is not letting this computer in. Most likely your internet address changed (new Wi-Fi, router restart, a new day).');
      console.error('Fix: Atlas → Network Access → Add IP Address → "Add Current IP Address" → Confirm. Wait a minute, then try again.');
    } else {
      console.error(msg.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[hidden]'));
    }
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, 'mongodb://[hidden]') : e);
  process.exit(1);
});
