import { timingSafeEqual } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_PASSWORD = process.env.FRACTURE_ADMIN_PASSWORD;

function passwordsMatch(input, expected) {
  const left = Buffer.from(String(input || ""));
  const right = Buffer.from(String(expected || ""));
  return left.length === right.length && timingSafeEqual(left, right);
}

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return applicationDefault();

  try {
    return cert(JSON.parse(raw));
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
  }
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: getCredential(),
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || "gen-lang-client-0002047847"
  });
}

function isoTimestamp(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return String(value);
}

function getAudit(project) {
  const analysis = project?.analysis;
  if (!analysis || typeof analysis !== "object") return null;
  if (analysis.audit && typeof analysis.audit === "object") return analysis.audit;
  if (analysis.report && typeof analysis.report === "object") return analysis.report;
  if (typeof analysis.overall_score === "number") return analysis;
  return null;
}

export async function listAdminUsers(password) {
  if (!ADMIN_PASSWORD) {
    return {
      ok: false,
      status: 503,
      body: { error: "Admin access is not configured." }
    };
  }

  if (!passwordsMatch(password, ADMIN_PASSWORD)) {
    return {
      ok: false,
      status: 401,
      body: { error: "Invalid admin password." }
    };
  }

  try {
    const snapshot = await getFirestore(getAdminApp()).collection("users").orderBy("lastSeen", "desc").get();
    const users = await Promise.all(snapshot.docs.map(async (entry) => {
      const user = entry.data();
      const recentProjects = await entry.ref.collection("projects").orderBy("updatedAt", "desc").limit(1).get();
      const recentProject = recentProjects.docs[0]?.data();
      const audit = getAudit(recentProject);
      return {
        email: user.email || "",
        fullName: user.name || "",
        provider: user.provider || "email",
        lastSeen: isoTimestamp(user.lastSeen),
        created: isoTimestamp(user.createdAt),
        latestUpload: recentProject ? {
          title: recentProject.title || "Untitled argument",
          draft: recentProject.draft || "",
          updated: isoTimestamp(recentProject.updatedAt),
          score: typeof audit?.overall_score === "number" ? audit.overall_score : null,
          verdict: audit?.verdict || ""
        } : null
      };
    }));

    return {
      ok: true,
      status: 200,
      body: {
        users,
        count: users.length,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "Firebase Admin account lookup is not configured on this server.",
        setup: "Set FIREBASE_SERVICE_ACCOUNT_JSON to a Firebase service-account JSON object, then restart or redeploy.",
        details: error?.message || String(error)
      }
    };
  }
}
