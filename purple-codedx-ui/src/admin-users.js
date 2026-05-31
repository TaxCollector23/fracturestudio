import PocketBase from "pocketbase";

const POCKETBASE_URL = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
const ADMIN_PASSWORD = process.env.FRACTURE_ADMIN_PASSWORD;

export async function listAdminUsers(password) {
  if (!ADMIN_PASSWORD) {
    return {
      ok: false,
      status: 503,
      body: { error: "The legacy local admin page is disabled on this server." }
    };
  }

  if (String(password || "") !== ADMIN_PASSWORD) {
    return {
      ok: false,
      status: 401,
      body: { error: "Invalid admin password." }
    };
  }

  const superuserEmail = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const superuserPassword = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  if (!superuserEmail || !superuserPassword) {
    return {
      ok: false,
      status: 503,
      body: {
        error: "PocketBase superuser credentials are not configured on this server.",
        setup: "Set POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD, then restart or redeploy."
      }
    };
  }

  const pocketbase = new PocketBase(POCKETBASE_URL);
  pocketbase.autoCancellation(false);

  try {
    await pocketbase.collection("_superusers").authWithPassword(superuserEmail, superuserPassword);
    const users = await pocketbase.collection("users").getFullList({ sort: "-lastSeen,-created" });
    return {
      ok: true,
      status: 200,
      body: {
        users: users.map((user) => ({
          email: user.email || "",
          fullName: user.name || "",
          provider: user.provider || "email",
          lastSeen: user.lastSeen || "",
          created: user.created || ""
        })),
        count: users.length,
        generated_at: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      body: {
        error: "PocketBase account lookup failed.",
        details: error?.message || String(error)
      }
    };
  } finally {
    pocketbase.authStore.clear();
  }
}
