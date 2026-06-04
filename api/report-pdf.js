import { createReportPdf } from "../src/report-pdf.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
  }

  if (!body?.audit || typeof body.audit !== "object") {
    return res.status(400).json({ error: "Run Fracture It before exporting a PDF report." });
  }

  try {
    const pdf = await createReportPdf({
      audit: body.audit,
      sources: body.sources,
      draft: body.draft,
      citationStyle: body.citation_style
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="fracture-studio-report.pdf"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pdf);
  } catch (err) {
    return res.status(500).json({ error: `PDF export could not complete: ${err?.message || String(err)}` });
  }
}
