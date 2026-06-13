// source-verify.js — Fracture Studio v6.0

export async function verifySources({ essay, audit, citationStyle }) {
  const claims = [];
  if (audit && Array.isArray(audit.claims)) {
    audit.claims.forEach(function (claim) {
      if (claim.quote) {
        claims.push({
          claim: claim.quote,
          truth_status: 'needs_review',
          why_check: 'Verify this claim with a primary source.',
          verification_step: 'Search Google Scholar or PubMed for peer-reviewed evidence.',
          sources_to_find: claim.sources_to_find || []
        });
      }
    });
  }
  return { claims, citation_style: citationStyle || 'mla', verified_at: new Date().toISOString() };
}
