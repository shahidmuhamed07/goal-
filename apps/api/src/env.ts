import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  STORE: z.enum(['mongo', 'memory']).default('mongo'),
  MONGODB_URI: z.string().optional(),
  MONGODB_DB: z.string().default('goalpath'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  /** The Firebase project that issues login tokens. Public information, not a secret. */
  FIREBASE_PROJECT_ID: z.string().default('goal-path-9f4cc'),
  /** Comma-separated emails allowed to use the admin. Empty means no login is set up. */
  ADMIN_EMAILS: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

/**
 * Reads and checks the settings once, at start. A missing or wrong setting stops
 * the server right away with a plain message, instead of failing later in a request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid settings:\n${problems}`);
  }
  const env = parsed.data;
  if (env.STORE === 'mongo' && !env.MONGODB_URI) {
    throw new Error(
      'MONGODB_URI is not set.\n' +
        '  Copy apps/api/.env.example to apps/api/.env and add your Atlas connection string,\n' +
        '  or start with STORE=memory for a demo that keeps nothing.',
    );
  }
  return env;
}
