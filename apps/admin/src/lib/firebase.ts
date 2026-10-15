import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth';
// The same public web settings the app uses. They identify the Firebase project, they are not secrets.
import config from '../firebaseConfig.json';

const app = initializeApp(config);
export const auth = getAuth(app);

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutAdmin = () => signOut(auth);

/** A fresh login token for the signed-in person, or null when nobody is signed in. */
export async function getIdToken(): Promise<string | null> {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
