// access.js — centralized authorization for the competition layer.
//
// Every page asks these functions before showing data or actions. They are
// pure and data-driven, mirroring the Firestore security rules in
// firestore.rules so the UI and the database agree. Guest sessions (no uid)
// are treated as full admins of everything they can see — a solo user running
// a tournament from one device.
//
// Data shapes these functions expect (see competition.js factories):
//   tournament = { admins: {uid: …}, judges: {uid: …}, participants: {uid: …} }
//   team       = { members: {uid: {role: "coach"|"admin"|"member", …}} }
//   round      = { judges: [uid], participants: {…} }
//   ballot     = { judgeId, status: "draft"|"submitted"|"locked" }

const COACH_ROLES = new Set(["coach", "admin"]);

function has(map, uid) {
  return !!map && uid != null && Object.prototype.hasOwnProperty.call(map, uid);
}

// ─── Tournaments ─────────────────────────────────────────────────────────────

/** 'admin' | 'judge' | 'participant' | null. Guests are admins. */
export function tournamentRole(tournament, uid) {
  if (!uid) return "admin";
  if (!tournament) return null;
  if (has(tournament.admins, uid)) return "admin";
  if (has(tournament.judges, uid)) return "judge";
  if (has(tournament.participants, uid)) return "participant";
  return null;
}

export const isTournamentAdmin = (t, uid) => tournamentRole(t, uid) === "admin";
export const isTournamentJudge = (t, uid) => tournamentRole(t, uid) === "judge";
export const isTournamentParticipant = (t, uid) => tournamentRole(t, uid) === "participant";

/** Anyone attached to the tournament can read it. */
export const canReadTournament = (t, uid) => tournamentRole(t, uid) != null;

/** Only admins organize rounds, events, people, and results. */
export const canManageTournament = (t, uid) => tournamentRole(t, uid) === "admin";

/** Admins can manage any round; assigned judges can operate within it. */
export const canManageRound = (t, uid) => isTournamentAdmin(t, uid);

// ─── Rounds ──────────────────────────────────────────────────────────────────

export function isRoundJudge(round, uid) {
  return !!round && Array.isArray(round.judges) && uid != null && round.judges.includes(uid);
}

/** A judge may judge a round only when assigned to it. Admins may fill in. */
export function canJudgeRound(t, round, uid) {
  if (isTournamentAdmin(t, uid)) return true;
  return isTournamentJudge(t, uid) && isRoundJudge(round, uid);
}

export function isRoundParticipant(round, uid) {
  return !!round && has(round.participants, uid);
}

export function canSeeRound(t, round, uid) {
  if (!t || !round) return false;
  if (canManageRound(t, uid)) return true;
  if (isRoundJudge(round, uid)) return true;
  if (isRoundParticipant(round, uid)) return true;
  return isTournamentParticipant(t, uid); // tournament participants see the schedule
}

// ─── Ballots ─────────────────────────────────────────────────────────────────

/** A judge may create a ballot for a round they were assigned to. */
export function canCreateBallot(t, round, uid) {
  if (isTournamentAdmin(t, uid)) return true;
  return isTournamentJudge(t, uid) && isRoundJudge(round, uid);
}

/** Ballots are visible to tournament members and to their own judge. */
export function canViewBallot(t, ballot, uid) {
  if (!t) return false;
  if (tournamentRole(t, uid) != null) return true;
  return uid != null && ballot?.judgeId === uid;
}

/** Drafts can be edited by their own judge; admins can fix/lock anything. */
export function canWriteBallot(t, ballot, uid) {
  if (isTournamentAdmin(t, uid)) return true;
  return uid != null && ballot?.judgeId === uid && ballot?.status === "draft";
}

export const canDeleteBallot = (t, ballot, uid) => isTournamentAdmin(t, uid) || (uid != null && ballot?.judgeId === uid && ballot?.status === "draft");

// ─── Teams ───────────────────────────────────────────────────────────────────

/** 'coach' | 'admin' | 'member' | null. Guests are coaches. */
export function teamRole(team, uid) {
  if (!uid) return "coach";
  if (!team) return null;
  const entry = team.members?.[uid];
  return entry ? (COACH_ROLES.has(entry.role) ? entry.role : "member") : null;
}

export const isTeamMember = (t, uid) => teamRole(t, uid) != null;
export const isTeamCoach = (t, uid) => COACH_ROLES.has(teamRole(t, uid));

/** Coaches manage the team; members can read shared content. */
export const canManageTeam = (t, uid) => isTeamCoach(t, uid);
export const canSeeTeam = (t, uid) => isTeamMember(t, uid);

export const canCreateAssignment = (t, uid) => isTeamCoach(t, uid);
export const canSeeAssignments = (t, uid) => isTeamMember(t, uid);

/** Members complete their own assignments; coaches review and give feedback. */
export const canCompleteAssignment = (t, uid) => isTeamMember(t, uid);
export const canReviewAssignments = (t, uid) => isTeamCoach(t, uid);

/** Aggregate progress across members is a coach view only. */
export const canSeeTeamProgress = (t, uid) => isTeamCoach(t, uid);

// ─── Calibration ─────────────────────────────────────────────────────────────

/** Comparing judges across rounds is a tournament-admin view. */
export const canSeeCalibration = (t, uid) => isTournamentAdmin(t, uid);

// ─── Notifications ───────────────────────────────────────────────────────────

export function canReceiveNotification(tournament, team, uid) {
  if (!uid) return false;
  if (tournament && tournamentRole(tournament, uid) != null) return true;
  if (team && teamRole(team, uid) != null) return true;
  return false;
}
