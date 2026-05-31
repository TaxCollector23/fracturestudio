/** Firebase browser configuration is public by design; security is enforced by auth and Firestore rules. */
export function getPublicAuthConfig() {
  return {
    firebaseConfig: {
      apiKey: process.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyCfvIx3BFLSW3jM7UVI55xEUWU6ruw_KGQ",
      authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0002047847.firebaseapp.com",
      projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || "gen-lang-client-0002047847",
      storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0002047847.firebasestorage.app",
      messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "275316382012",
      appId: process.env.PUBLIC_FIREBASE_APP_ID || "1:275316382012:web:a14a8dbd90690cddcfa639"
    },
    siteUrl: process.env.SITE_URL || ""
  };
}
