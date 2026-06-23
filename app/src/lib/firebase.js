// Firebase auth + Firestore, loaded from the gstatic CDN (matches the legacy app).
// Config comes from /api/public-config (public by design; secured by Firebase rules).

const VERSION = "10.12.2";
const CDN = {
  app: `https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`,
  auth: `https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`,
  store: `https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`
};

let servicesPromise = null;

async function getServices() {
  if (servicesPromise) return servicesPromise;
  servicesPromise = (async () => {
    const cfgRes = await fetch("/api/public-config", { cache: "no-store" });
    const cfg = await cfgRes.json();
    const config = cfg.firebaseConfig;
    const [appMod, authMod, storeMod] = await Promise.all([
      import(/* @vite-ignore */ CDN.app),
      import(/* @vite-ignore */ CDN.auth),
      import(/* @vite-ignore */ CDN.store)
    ]);
    const fbApp = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
    const auth = authMod.getAuth(fbApp);
    const db = storeMod.getFirestore(fbApp);
    return { auth, db, authMod, storeMod };
  })();
  return servicesPromise;
}

export function normalizeUser(u) {
  if (!u) return null;
  const providerId = u.providerData?.[0]?.providerId;
  return {
    id: u.uid,
    email: u.email || "",
    name: u.displayName || (u.email ? u.email.split("@")[0] : "Scholar"),
    provider: providerId === "google.com" ? "google" : "email"
  };
}

export async function onAuthChange(cb) {
  const { auth, authMod } = await getServices();
  return authMod.onAuthStateChanged(auth, (u) => cb(normalizeUser(u)));
}

export async function signInWithGoogle() {
  const { auth, authMod } = await getServices();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await authMod.signInWithPopup(auth, provider);
  return normalizeUser(cred.user);
}

export async function signInWithEmail(email, password) {
  const { auth, authMod } = await getServices();
  const cred = await authMod.signInWithEmailAndPassword(auth, email.trim(), password);
  return normalizeUser(cred.user);
}

export async function createEmailAccount(email, password) {
  const { auth, authMod } = await getServices();
  const cred = await authMod.createUserWithEmailAndPassword(auth, email.trim(), password);
  return normalizeUser(cred.user);
}

export async function sendReset(email) {
  const { auth, authMod } = await getServices();
  await authMod.sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  const { auth, authMod } = await getServices();
  await authMod.signOut(auth);
}

// ---- Firestore: saved projects (Past Work) + preferences ----
export async function saveProject(userId, project) {
  const { db, storeMod } = await getServices();
  const now = storeMod.serverTimestamp();
  const ref = await storeMod.addDoc(
    storeMod.collection(db, "users", userId, "projects"),
    { ...project, createdAt: now, updatedAt: now }
  );
  return ref.id;
}

export async function listProjects(userId) {
  const { db, storeMod } = await getServices();
  const q = storeMod.query(
    storeMod.collection(db, "users", userId, "projects"),
    storeMod.orderBy("updatedAt", "desc"),
    storeMod.limit(50)
  );
  const snap = await storeMod.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProject(userId, id) {
  const { db, storeMod } = await getServices();
  const ref = storeMod.doc(db, "users", userId, "projects", id);
  const snap = await storeMod.getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function loadPreferences(userId) {
  const { db, storeMod } = await getServices();
  const ref = storeMod.doc(db, "users", userId, "settings", "preferences");
  const snap = await storeMod.getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function savePreferences(userId, prefs) {
  const { db, storeMod } = await getServices();
  const ref = storeMod.doc(db, "users", userId, "settings", "preferences");
  await storeMod.setDoc(ref, prefs, { merge: true });
}

// Write user profile to users/{userId} so admin can see who has signed in.
export async function touchUserProfile(userId, { email, name, provider }) {
  const { db, storeMod } = await getServices();
  const ref = storeMod.doc(db, "users", userId);
  await storeMod.setDoc(ref, {
    email: email || "",
    name: name || "",
    provider: provider || "email",
    lastSeen: storeMod.serverTimestamp()
  }, { merge: true });
}
