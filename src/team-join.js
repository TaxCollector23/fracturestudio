// team-join.js — join a team by its shareable join code.
//
// Joining by code cannot be done purely client-side: the rules only let
// members read team docs, and listing all teams would leak every team's
// member list. So the code lookup happens here with the Admin SDK (which
// bypasses the client rules). The caller's Firebase ID token is verified so
// a stranger cannot add other people to a team.
//
// The exact same code path is used by the Express dev server (src/server.js)
// and the Vercel serverless route (api/team-join.js).

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let credential = applicationDefault();
  if (raw) {
    try {
      credential = cert(JSON.parse(raw));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.");
    }
  }
  return initializeApp({
    credential,
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || "gen-lang-client-0002047847"
  });
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function joinTeamByCode(req) {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, body: { error: "Sign in to join a team." } };
  }

  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) {
    return { ok: false, status: 400, body: { error: "Enter the team join code." } };
  }

  let identity;
  try {
    identity = await getAuth(getAdminApp()).verifyIdToken(token);
  } catch {
    return { ok: false, status: 401, body: { error: "Your session is invalid — sign in again." } };
  }

  try {
    const db = getFirestore(getAdminApp());
    const teamsRef = db.collection("teams");
    const match = await teamsRef.where("code", "==", code).limit(1).get();
    if (match.empty) {
      return { ok: false, status: 404, body: { error: "No team has that join code. Double-check it with your coach." } };
    }

    const teamDoc = match.docs[0];
    const team = teamDoc.data();
    const members = team.members || {};
    if (members[identity.uid]) {
      return { ok: false, status: 409, body: { error: "You are already a member of that team." } };
    }

    const name = identity.name || (identity.email ? identity.email.split("@")[0] : "");
    const now = new Date().toISOString();
    await teamDoc.ref.update({
      [`members.${identity.uid}`]: { role: "member", name, email: identity.email || "", joinedAt: now }
    });
    await db.doc(`users/${identity.uid}/teams/${teamDoc.id}`).set({
      id: teamDoc.id,
      role: "member",
      name: team.name || "",
      updatedAt: now
    }, { merge: true });

    return {
      ok: true,
      status: 200,
      body: { ok: true, team: { id: teamDoc.id, name: team.name || "Team" } }
    };
  } catch (error) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "Team joining is not configured on this server.",
        setup: "Set FIREBASE_SERVICE_ACCOUNT_JSON (or Application Default Credentials) to enable team joins.",
        details: error?.message || String(error)
      }
    };
  }
}
