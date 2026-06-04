import { timingSafeEqual } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_PASSWORD = process.env.FRACTURE_ADMIN_PASSWORD;
const RECENT_ACTIVE_MS = 1000 * 60 * 60 * 24 * 7;

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
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function dateMs(value) {
  const iso = isoTimestamp(value);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAudit(project) {
  const analysis = project?.analysis;
  if (!analysis || typeof analysis !== "object") return null;
  if (analysis.audit && typeof analysis.audit === "object") return analysis.audit;
  if (analysis.report && typeof analysis.report === "object") return analysis.report;
  if (typeof analysis.overall_score === "number") return analysis;
  return null;
}

function getScore(project) {
  const audit = getAudit(project);
  return typeof audit?.overall_score === "number" ? audit.overall_score : null;
}

function getVerdict(project) {
  const audit = getAudit(project);
  return typeof audit?.verdict === "string" ? audit.verdict : "";
}

function latestWrittenText(project) {
  const candidates = [
    project?.draft,
    project?.speech,
    project?.essay,
    project?.argument,
    project?.text,
    project?.content,
    project?.body,
    project?.input,
    project?.originalText,
    project?.submission
  ];
  const value = candidates.find((item) => typeof item === "string" && item.trim());
  return value ? value.trim() : "";
}

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function projectMinutes(project) {
  const candidates = [
    project?.minutesSpent,
    project?.timeSpentMinutes,
    project?.usageMinutes,
    project?.durationMinutes,
    project?.analysisDurationMs ? Number(project.analysisDurationMs) / 60000 : null,
    project?.elapsedMs ? Number(project.elapsedMs) / 60000 : null,
    project?.durationMs ? Number(project.durationMs) / 60000 : null
  ];
  const value = candidates.find((item) => Number.isFinite(Number(item)) && Number(item) > 0);
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function compactProject(project, id = "") {
  const writtenText = latestWrittenText(project);
  return {
    id,
    title: project?.title || "Untitled argument",
    draft: writtenText,
    fullText: writtenText,
    updated: isoTimestamp(project?.updatedAt || project?.updated),
    created: isoTimestamp(project?.createdAt || project?.created),
    score: getScore(project),
    verdict: getVerdict(project),
    wordCount: wordCount(writtenText),
    characterCount: writtenText.length,
    minutesSpent: projectMinutes(project)
  };
}

function average(values) {
  const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function activityLabel(user, projects) {
  const lastProjectMs = Math.max(0, ...projects.map((project) => dateMs(project.updatedAt || project.updated)));
  const lastSeenMs = dateMs(user?.lastSeen);
  const latestMs = Math.max(lastProjectMs, lastSeenMs);
  if (!latestMs) return "Not recorded";

  const ageMs = Date.now() - latestMs;
  if (ageMs < 1000 * 60 * 60) return "Used in the last hour";
  if (ageMs < 1000 * 60 * 60 * 24) return "Used today";
  if (ageMs < RECENT_ACTIVE_MS) return "Used this week";
  return "Last used " + new Date(latestMs).toLocaleDateString("en-US");
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
      const projectsSnapshot = await entry.ref
        .collection("projects")
        .orderBy("updatedAt", "desc")
        .get();

      const rawProjects = projectsSnapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
      const recentProjects = rawProjects.map((entry) => compactProject(entry.data, entry.id));
      const allWritings = recentProjects;
      const scores = recentProjects.map((project) => project.score).filter((score) => typeof score === "number");
      const avgScore = average(scores);
      const minutes = recentProjects.map((project) => project.minutesSpent).filter((value) => typeof value === "number");
      const totalMinutes = minutes.length ? minutes.reduce((sum, value) => sum + value, 0) : null;
      const latestActivity = Math.max(dateMs(user.lastSeen), ...rawProjects.map((project) => dateMs(project.data?.updatedAt || project.data?.updated)));

      return {
        id: entry.id,
        email: user.email || "",
        fullName: user.name || user.displayName || "",
        provider: user.provider || "email",
        lastSeen: isoTimestamp(user.lastSeen),
        created: isoTimestamp(user.createdAt),
        recentlyUsed: activityLabel(user, rawProjects.map((project) => project.data)),
        activeLast7Days: latestActivity ? Date.now() - latestActivity <= RECENT_ACTIVE_MS : false,
        projectCount: recentProjects.length,
        averageScore: avgScore === null ? null : Math.round(avgScore),
        bestScore: scores.length ? Math.max(...scores) : null,
        latestScore: scores.length ? scores[0] : null,
        minutesSpent: totalMinutes,
        latestUpload: recentProjects[0] || null,
        allWritings,
        recentProjects
      };
    }));

    const allScores = users.flatMap((user) => user.recentProjects || []).map((project) => project.score).filter((score) => typeof score === "number");
    const allMinutes = users.map((user) => user.minutesSpent).filter((value) => typeof value === "number");

    return {
      ok: true,
      status: 200,
      body: {
        users,
        count: users.length,
        summary: {
          totalUsers: users.length,
          totalProjects: users.reduce((sum, user) => sum + Number(user.projectCount || 0), 0),
          activeLast7Days: users.filter((user) => user.activeLast7Days).length,
          averageScore: average(allScores),
          minutesSpent: allMinutes.length ? allMinutes.reduce((sum, value) => sum + value, 0) : null
        },
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
