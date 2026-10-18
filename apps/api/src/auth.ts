import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Who a valid login token belongs to. */
export interface Identity {
  /** The account's own id, the same one the app sees as `user.uid`. */
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** Checks a login token and says whose it is, or throws when it is not valid. */
export type TokenVerifier = (token: string) => Promise<Identity>;

export interface AdminAuth {
  verify: TokenVerifier;
  /** Lower-case emails of the owners (from the private settings). Owners may also manage the team. */
  ownerEmails: string[];
}

/** Google publishes the keys that sign every Firebase login token here. */
const GOOGLE_KEYS = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');

/**
 * Verifies a Firebase ID token the way Firebase's own library does, with no
 * secret needed: the token must be signed by Google's published keys, issued
 * for this Firebase project, and not expired.
 */
export function createFirebaseVerifier(projectId: string): TokenVerifier {
  const keys = createRemoteJWKSet(GOOGLE_KEYS);
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub || typeof payload.email !== 'string') throw new Error('token has no account');
    return {
      uid: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  };
}

/** `a@x.com, B@y.com` becomes `['a@x.com', 'b@y.com']`. */
export function parseEmails(list: string | undefined): string[] {
  return (list ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
