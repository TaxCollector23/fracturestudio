import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { handleAnalyze } from "./analyze-handler.js";
import { listAdminUsers } from "./admin-users.js";
import { joinTeamByCode } from "./team-join.js";
import { getPublicAuthConfig } from "./public-config.js";
import { extractSourceMetadata } from "./metadata.js";
import { verifySources } from "./source-verify.js";
import { handleTextStream } from "./text-stream-handler.js";
import { createReportPdf } from "./report-pdf.js";
import { loadEnv } from "./env.js";
import { getHealthPayload } from "./health.js";
import { LIMITS, sendError } from "./request-utils.js";
import { logError, logInfo, logRequest } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv();
const app = express();
const PORT = process.env.PORT || 8000;
const PUBLIC_DIR = join(__dirname, "../public");

app.use(logRequest);
app.use(express.json({ limit: "256kb" }));

// Keep both clean URLs and static filenames available in development.
app.use(express.static(PUBLIC_DIR));
app.get(["/studio", "/studio/case"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "studio.html"));
});
app.use("/studio", express.static(PUBLIC_DIR));

app.post("/api/analyze", handleAnalyze);
app.post("/api/chat", (req, res) => handleTextStream(req, res, "chat"));
app.post("/api/rebuttal", (req, res) => handleTextStream(req, res, "rebuttal"));

app.post("/api/verify-sources", async (req, res) => {
  const essay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  const audit = req.body?.audit && typeof req.body.audit === "object" ? req.body.audit : null;
  const citationStyle = req.body?.citation_style === "apa" ? "apa" : "mla";

  if (!essay && !audit) {
    return sendError(res, 400, "Provide draft text or a Fracture report to verify.");
  }
  if (essay.length > LIMITS.verifySourcesCharacters) {
    return sendError(res, 400, `Draft exceeds the ${LIMITS.verifySourcesCharacters.toLocaleString()} character limit.`);
  }

  try {
    return res.status(200).json(await verifySources({ essay, audit, citationStyle }));
  } catch (err) {
    logError("verify-sources.failed", err);
    return sendError(res, 503, `Source verification could not complete: ${err?.message || String(err)}`);
  }
});

app.post("/api/report-pdf", async (req, res) => {
  if (!req.body?.audit || typeof req.body.audit !== "object") {
    return sendError(res, 400, "Run Fracture It before exporting a PDF report.");
  }

  try {
    const pdf = await createReportPdf({
      audit: req.body.audit,
      sources: req.body.sources,
      draft: req.body.draft,
      citationStyle: req.body.citation_style
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="fracture-studio-report.pdf"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (err) {
    logError("report-pdf.failed", err);
    return sendError(res, 500, "PDF export could not complete.");
  }
});

app.post("/api/admin-users", async (req, res) => {
  const result = await listAdminUsers(req.body?.password);
  return res.status(result.status).json(result.body);
});

app.post("/api/team-join", async (req, res) => {
  const result = await joinTeamByCode(req);
  return res.status(result.status).json(result.body);
});

app.post("/api/metadata", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!url) {
    return sendError(res, 400, "Provide a URL to extract metadata from.");
  }
  const result = await extractSourceMetadata(url);
  return res.status(result.status === "ok" ? 200 : 422).json(result);
});

app.get("/api/public-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getPublicAuthConfig());
});

app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getHealthPayload());
});

app.get(["/about", "/mission", "/methods"], (_req, res) => res.sendFile(join(PUBLIC_DIR, "about.html")));
app.get("/docs", (_req, res) => res.redirect(302, "https://fracturestudio.mintlify.app"));
app.get("/blog", (_req, res) => res.sendFile(join(PUBLIC_DIR, "blog.html")));
app.get(["/changelog", "/changelog.html"], (_req, res) => res.redirect(302, "/"));
app.get(["/credits", "/credits.html"], (_req, res) => res.redirect(302, "/"));
app.get(["/contact", "/contact.html"], (_req, res) => res.redirect(302, "/"));
app.get(["/onboarding", "/onboarding.html"], (_req, res) => res.redirect(302, "/"));
app.get("/past-work", (_req, res) => res.sendFile(join(PUBLIC_DIR, "past-work.html")));
app.get("/rebuttals", (_req, res) => res.sendFile(join(PUBLIC_DIR, "rebuttals.html")));
app.get(["/settings", "/login"], (_req, res) => res.sendFile(join(PUBLIC_DIR, "settings.html")));
app.get("/auth/callback", (_req, res) => res.sendFile(join(PUBLIC_DIR, "auth-callback.html")));
app.get("/admin", (_req, res) => res.sendFile(join(PUBLIC_DIR, "admin.html")));

app.use((_req, res) => {
  sendError(res, 404, "Not found");
});

// Central error handler: keeps unexpected failures off the wire as raw stacks
// while still logging enough detail to debug.
app.use((err, _req, res, _next) => {
  logError("http.unhandled", err);
  sendError(res, 500, "Something went wrong. Please try again.");
});

app.listen(PORT, () => {
  logInfo("server.started", { port: PORT });
  console.log(`\nFracture Studio running at http://localhost:${PORT}\n`);
});
