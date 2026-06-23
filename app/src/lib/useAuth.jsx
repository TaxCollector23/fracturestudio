import { createContext, useContext, useEffect, useState } from "react";
import * as fb from "./firebase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub = () => {};
    fb.onAuthChange((u) => {
      setUser(u);
      setReady(true);
      if (u) {
        // Write profile to Firestore so the admin panel can see who has signed in.
        fb.touchUserProfile(u.id, { email: u.email, name: u.name, provider: u.provider })
          .catch(() => {});
      }
    })
      .then((fn) => { unsub = fn || (() => {}); })
      .catch(() => setReady(true));
    return () => unsub();
  }, []);

  const value = {
    user,
    ready,
    signInWithGoogle: fb.signInWithGoogle,
    signInWithEmail: fb.signInWithEmail,
    createEmailAccount: fb.createEmailAccount,
    sendReset: fb.sendReset,
    signOut: fb.signOutUser
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
