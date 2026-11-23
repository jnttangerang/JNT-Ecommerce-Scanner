import { getDatabase } from 'firebase/database';
import { app, auth } from './utils/auth';
import firebaseConfig from '../firebase-applet-config.json';

// ponytail: RTDB dipakai khusus untuk counter rekonsiliasi real-time lintas perangkat (bukan pengganti Sheets).
const rtdbUrl =
  (import.meta as any).env?.VITE_FIREBASE_DATABASE_URL ||
  (firebaseConfig as { databaseURL?: string }).databaseURL ||
  `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;

export const rtdb = getDatabase(app, rtdbUrl);
export { app, auth };
