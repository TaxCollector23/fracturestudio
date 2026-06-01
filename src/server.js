import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { handleAnalyze } from "./analyze-handler.js";
import { listAdminUsers } from "./admin-users.js";
import { getPublicAuthConfig } from "./public-config.js";
import { verifySources } from "./source-verify.js";
import { handleTextStream } from "./text-stream-handler.js";
import { createReportPdf } from "./report-pdf.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(__dirname, "../public");

app.use(express.json({ limit: "256kb" }));

// Keep both clean URLs and static filenames available in development.
app.use(express.static(PUBLIC_DIR));
app.use("/studio", express.static(PUBLIC_DIR));

app.post("/api/analyze", handleAnalyze);
app.post("/api/chat", (req, res) => handleTextStream(req, res, "chat"));
app.post("/api/rebuttal", (req, res) => handleTextStream(req, res, "rebuttal"));

app.post("/api/verify-sources", async (req, res) => {
  const essay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  const audit = req.body?.audit && typeof req.body.audit === "object" ? req.body.audit : null;
  const citationStyle = req.body?.citation_style === "apa" ? "apa" : "mla";

  if (!essay && !audit) {
    return res.status(400).json({ error: "Provide draft text or a Fracture report to verify." });
  }
  if (essay.length > 40000) {
    return res.status(400).json({ error: "Draft exceeds the 40,000 character limit." });
  }

  try {
    return res.status(200).json(await verifySources({ essay, audit, citationStyle }));
  } catch (err) {
    return res.status(503).json({
      error: `Source verification could not complete: ${err?.message || String(err)}`
    });
  }
});

app.post("/api/report-pdf", async (req, res) => {
  if (!req.body?.audit || typeof req.body.audit !== "object") {
    return res.status(400).json({ error: "Run Fracture It before exporting a PDF report." });
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
    return res.status(500).json({ error: `PDF export could not complete: ${err?.message || String(err)}` });
  }
});

app.post("/api/admin-users", async (req, res) => {
  const result = await listAdminUsers(req.body?.password);
  return res.status(result.status).json(result.body);
});

app.get("/api/public-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getPublicAuthConfig());
});

app.get(["/studio", "/studio/case", "/analyze"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "studio.html"));
});
app.get("/mission", (_req, res) => res.sendFile(join(PUBLIC_DIR, "mission.html")));
app.get("/blog", (_req, res) => res.sendFile(join(PUBLIC_DIR, "blog.html")));
app.get(["/settings", "/login"], (_req, res) => res.sendFile(join(PUBLIC_DIR, "settings.html")));
app.get("/auth/callback", (_req, res) => res.sendFile(join(PUBLIC_DIR, "auth-callback.html")));
app.get("/admin", (_req, res) => res.sendFile(join(PUBLIC_DIR, "admin.html")));

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`\nFracture Studio running at http://localhost:${PORT}\n`);
});
