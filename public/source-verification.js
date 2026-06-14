/* source-verification.js - standalone source verification panel */
(function () {
  'use strict';

  const STYLE_ID = 'fracture-source-verification-style';
  const ENDPOINT = '/api/verify-sources';

  function text(value, fallback) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return fallback || '';
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function citationStyle(value) {
    return text(value, '').toLowerCase() === 'apa' ? 'apa' : 'mla';
  }

  function statusTone(status) {
    const normalized = text(status, 'needs review').toLowerCase().replace(/_/g, ' ');
    if (/\b(likely supported|verified|accurate|pass|strong|ok)\b/.test(normalized)) return 'ok';
    if (/\b(partial|match|mixed|unclear|review|warning|weak|incomplete)\b/.test(normalized)) return 'warn';
    if (/\b(false|unsupported|not supported|missing|failed|fabricated|mismatch|error|not found|conflict)\b/.test(normalized)) return 'bad';
    return 'warn';
  }

  function statusLabel(status) {
    const labels = {
      likely_supported: 'Tentative source match',
      partial_match: 'Tentative partial match',
      needs_source_review: 'Needs a closer look',
      possible_conflict: 'Possible conflict',
      source_not_found: 'Not supported by public retrieval',
      quote_not_supported: 'Quoted passage not supported',
      citation_incomplete: 'Citation details missing',
      source_too_vague: 'Claim is too vague to check',
      needs_review: 'Needs review'
    };
    const key = text(status, 'needs_review').toLowerCase().replace(/\s+/g, '_');
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function citationIssues(items) {
    const labels = {
      missing_author: 'author',
      missing_title: 'title',
      missing_date: 'publication date',
      missing_locator: 'link or page location',
      vague_source_reference: 'specific source name',
      source_needed: 'supporting source'
    };
    const missing = asArray(items).map(function (item) { return labels[item] || String(item).replace(/_/g, ' '); });
    return missing.length ? 'Citation details to add: ' + missing.join(', ') + '.' : '';
  }

  function nextStep(status) {
    const key = text(status, 'needs_review').toLowerCase().replace(/\s+/g, '_');
    const steps = {
      likely_supported: 'Open the source and confirm the exact passage before submitting your work.',
      partial_match: 'Open the source. It appears related, but your sentence may need to be narrower or more precise.',
      needs_source_review: 'Inspect the suggested pages and replace the citation if none directly support your sentence.',
      possible_conflict: 'Read the source carefully. The retrieved page may disagree with part of your sentence.',
      source_not_found: 'Public retrieval did not support this sentence. Find a direct source or remove the unsupported detail.',
      quote_not_supported: 'Public retrieval did not support this quotation. Locate the original passage or remove the quotation.',
      citation_incomplete: 'Add the missing citation details so the source can be checked with confidence.',
      source_too_vague: 'Rewrite the claim with clearer names, dates, or terms before checking it again.',
      needs_review: 'Review the source manually before relying on this claim.'
    };
    return steps[key] || steps.needs_review;
  }

  function makeEl(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined && content !== null) el.textContent = String(content);
    return el;
  }

  function append(parent) {
    for (let i = 1; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child) parent.appendChild(child);
    }
    return parent;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.fracture-sources{margin-top:18px;color:var(--text-1,#f7f2e8);font-family:inherit}',
      '.fracture-source-card{position:relative;overflow:hidden;border:1px solid var(--border,#2c3340);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));box-shadow:0 18px 42px rgba(0,0,0,.24)}',
      '.fracture-source-card::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)}',
      '.fracture-source-head{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:18px 18px 14px;border-bottom:1px solid var(--border,#2c3340)}',
      '.fracture-source-mark{display:grid;width:36px;height:32px;place-items:center;background:#ef4444;color:#fff;clip-path:polygon(50% 0,100% 100%,0 100%);font-size:16px;font-weight:900;font-family:Arial,sans-serif;padding-top:8px}',
      '.fracture-source-kicker{font-size:11px;line-height:1;text-transform:uppercase;letter-spacing:.16em;color:var(--text-3,#9ca3af);font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)}',
      '.fracture-source-title{margin-top:5px;font-size:18px;font-weight:760;color:var(--text-1,#f7f2e8)}',
      '.fracture-source-summary{margin-top:5px;font-size:13px;line-height:1.45;color:var(--text-2,#cbd5e1)}',
      '.fracture-source-score{min-width:84px;text-align:center;border:1px solid var(--border,#2c3340);border-radius:8px;padding:8px 10px;background:rgba(0,0,0,.14)}',
      '.fracture-source-score b{display:block;font-size:22px;line-height:1;color:var(--text-1,#f7f2e8)}',
      '.fracture-source-score span{display:block;margin-top:4px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-3,#9ca3af);font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)}',
      '.fracture-source-body{padding:16px 18px 18px}',
      '.fracture-source-section + .fracture-source-section{margin-top:18px}',
      '.fracture-source-section h3{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--text-3,#9ca3af);font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)}',
      '.fracture-source-rows{display:grid;gap:10px}',
      '.fracture-source-row{display:grid;gap:11px;border:1px solid var(--border,#2c3340);border-radius:8px;padding:14px;background:rgba(255,255,255,.025)}',
      '.fracture-source-row-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
      '.fracture-source-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-3,#9ca3af);font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace);margin-bottom:5px}',
      '.fracture-source-text{font-size:13px;line-height:1.45;color:var(--text-2,#cbd5e1);word-break:break-word}',
      '.fracture-source-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}',
      '.fracture-source-guidance{border-top:1px solid var(--border,#2c3340);padding-top:10px}',
      '.fracture-source-link{color:var(--accent-2,#93c5fd);font-size:13px;text-decoration:none}',
      '.fracture-source-link:hover{text-decoration:underline}',
      '.fracture-source-status{display:inline-flex;align-items:center;gap:7px;max-width:100%;border-radius:999px;padding:6px 9px;font-size:11px;line-height:1.1;font-weight:760;text-transform:uppercase;letter-spacing:.08em;font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)}',
      '.fracture-source-status::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;flex:0 0 auto}',
      '.fracture-source-status.ok{color:#22c55e;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.35)}',
      '.fracture-source-status.warn{color:#f59e0b;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35)}',
      '.fracture-source-status.bad{color:#ef4444;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35)}',
      '.fracture-works-cited{margin:0;padding-left:21px;color:var(--text-2,#cbd5e1)}',
      '.fracture-works-cited li{margin:8px 0;font-size:13px;line-height:1.45;word-break:break-word}',
      '.fracture-source-empty{border:1px dashed var(--border,#2c3340);border-radius:8px;padding:14px;color:var(--text-3,#9ca3af);font-size:13px;line-height:1.45}',
      '.fracture-source-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px}',
      '.fracture-source-button{appearance:none;border:1px solid var(--border,#2c3340);border-radius:8px;background:rgba(255,255,255,.06);color:var(--text-1,#f7f2e8);font:inherit;font-size:12px;font-weight:760;padding:9px 12px;cursor:pointer}',
      '.fracture-source-button:hover{border-color:var(--border-2,#596273);background:rgba(255,255,255,.09)}',
      '.fracture-source-button:disabled{opacity:.55;cursor:not-allowed}',
      '.fracture-source-style{display:inline-flex;gap:2px;border:1px solid var(--border,#2c3340);border-radius:7px;padding:2px;background:rgba(0,0,0,.12)}',
      '.fracture-source-style-button{appearance:none;border:0;border-radius:5px;background:transparent;color:var(--text-3,#9ca3af);cursor:pointer;font:inherit;font-size:11px;font-weight:760;letter-spacing:.08em;padding:7px 9px;text-transform:uppercase}',
      '.fracture-source-style-button[aria-pressed="true"]{background:var(--text-1,#f7f2e8);color:var(--bg,#10151e)}',
      '.fracture-source-note{font-size:12px;line-height:1.4;color:var(--text-3,#9ca3af);margin-top:10px}',
      '.fracture-research-grid{display:grid;gap:10px}',
      '.fracture-research-card{border:1px solid var(--border,#2c3340);border-radius:8px;padding:14px;background:rgba(115,162,255,.055)}',
      '.fracture-research-card strong{display:block;margin:0 0 6px;color:var(--text-1,#f7f2e8);font-size:14px}',
      '.fracture-research-card p{margin:0 0 10px;color:var(--text-2,#cbd5e1);font-size:13px;line-height:1.45}',
      '.fracture-research-links{display:grid;gap:7px}',
      '.fracture-research-links a{color:var(--accent-2,#93c5fd);font-size:13px;text-decoration:none;line-height:1.35}',
      '.fracture-research-links a:hover{text-decoration:underline}',
      '@media (max-width:720px){.fracture-source-head{grid-template-columns:auto 1fr}.fracture-source-score{grid-column:1 / -1;text-align:left}.fracture-source-grid{grid-template-columns:1fr}.fracture-source-actions{justify-content:stretch}.fracture-source-button{width:100%}}',
      '[data-theme="light"] .fracture-source-card{background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(248,250,252,.88));box-shadow:0 18px 42px rgba(15,23,42,.12)}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function citationForStyle(item, style) {
    if (typeof item === 'string') return item.trim();
    return text(style === 'apa' ? item.apa : item.mla, text(item.entry || item.citation || item.reference || item.title || item.url || item.source, ''));
  }

  function normalizeRows(data, style) {
    const fromRows = asArray(data && (data.rows || data.verification_rows || data.claim_source_statuses));
    if (fromRows.length) return fromRows.map(function (row) {
      return {
        claim: text(row.claim || row.text || row.statement || row.quote, 'Claim not specified.'),
        status: text(row.status || row.verdict || row.support_status, 'Needs review'),
        source: text(row.source || row.citation || row.reference || row.url || row.evidence, 'No source supplied.'),
        sourceTitle: text(row.source_title || row.title, ''),
        sourceUrl: text(row.source_url || row.url, ''),
        note: text(row.note || row.notes || row.explanation || row.issue || row.fix, ''),
        issues: citationIssues(row.citation_issues)
      };
    });

    return asArray(data && (data.claims || data.checked_claims || data.verifications)).map(function (claim) {
      const firstSource = asArray(claim.sources)[0] || {};
      const sourceLabel = text(
        claim.source || claim.citation || claim.reference || claim.url || claim.evidence ||
        citationForStyle(firstSource, style) || firstSource.title || firstSource.url,
        'No source supplied.'
      );
      const issueText = asArray(claim.citation_issues).length
        ? 'Citation issues: ' + asArray(claim.citation_issues).join(', ') + '. '
        : '';
      return {
        claim: text(claim.claim || claim.text || claim.statement || claim.quote, 'Claim not specified.'),
        status: text(claim.status || claim.verdict || claim.support_status || claim.rating, 'Needs review'),
        source: sourceLabel,
        sourceTitle: text(firstSource.title, ''),
        sourceUrl: text(firstSource.url, ''),
        note: text(claim.note || claim.notes || claim.explanation || claim.issue || claim.fix || claim.verification_note, ''),
        issues: citationIssues(claim.citation_issues) || issueText
      };
    });
  }

  function normalizeWorksCited(data, style) {
    const explicit = asArray(data && (data.works_cited || data.worksCited || data.citations || data.references));
    return explicit.map(function (item) {
      return citationForStyle(item, style);
    }).filter(Boolean);
  }

  function normalizeResearchIdeas(data) {
    return asArray(data && (data.research_suggestions || data.extra_arguments || data.researchIdeas)).map(function (item) {
      const links = asArray(item.links || item.sources || item.support_links).map(function (link) {
        return {
          title: text(link.title || link.site_name || link.url, 'Open source lead'),
          url: text(link.url, ''),
          note: text(link.snippet || link.note || link.description, '')
        };
      }).filter(function (link) { return link.url; });
      return {
        label: text(item.label || item.type, 'Research lead'),
        title: text(item.title || item.angle || item.suggestion, 'Extra argument to investigate'),
        explanation: text(item.explanation || item.reason || item.note, 'Open these links and only use the idea if the source directly supports your thesis.'),
        links: links
      };
    }).filter(function (item) { return item.title || item.links.length; });
  }

  function scoreFromRows(data, rows) {
    const explicit = data && (data.score || data.verification_score || data.source_score);
    if (explicit !== undefined && explicit !== null && explicit !== '') return text(explicit, 'Review');
    if (!rows.length) return 'Review';
    const good = rows.filter(function (row) { return statusTone(row.status) === 'ok'; }).length;
    return good + ' of ' + rows.length;
  }

  function summaryText(payload) {
    if (typeof payload.summary === 'string') return payload.summary;
    if (payload.summary && typeof payload.summary === 'object') {
      const s = payload.summary;
      const total = text(s.total_claims, '0');
      const supported = text(s.likely_supported || s.supported, '0');
      const review = Number(s.needs_source_review || 0) + Number(s.partial_match || 0) + Number(s.possible_conflict || 0);
      const missing = Number(s.citation_incomplete || 0) + Number(s.source_not_found || 0) + Number(s.quote_not_supported || 0);
      return 'Fracture checked ' + total + ' draft passages for citation support. '
        + supported + (Number(supported) === 1 ? ' has' : ' have') + ' a tentative public-web match. '
        + review + (review === 1 ? ' needs' : ' need') + ' a closer look. '
        + missing + (missing === 1 ? ' needs' : ' need') + ' a better or more complete citation.';
    }
    return text(payload.overall || payload.verdict, 'Review each claim against the source it relies on before final submission.');
  }

  function renderVerification(data) {
    injectStyles();
    const payload = data && typeof data === 'object' ? data : {};
    const style = citationStyle(payload.citation_style);
    const rows = normalizeRows(payload, style);
    const worksCited = normalizeWorksCited(payload, style);
    const researchIdeas = normalizeResearchIdeas(payload);
    const bibliographyTitle = style === 'apa' ? 'References' : 'Works Cited';
    const edition = style === 'apa' ? 'APA 7th edition' : 'MLA 9th edition';
    const card = makeEl('section', 'fracture-source-card');
    const head = makeEl('div', 'fracture-source-head');
    const mark = makeEl('div', 'fracture-source-mark', '!');
    mark.setAttribute('aria-hidden', 'true');

    const titleBlock = makeEl('div', 'fracture-source-heading');
    append(
      titleBlock,
      makeEl('div', 'fracture-source-kicker', 'Source review · ' + edition),
      makeEl('div', 'fracture-source-title', text(payload.title, 'Check what your sources actually support')),
      makeEl('div', 'fracture-source-summary', summaryText(payload))
    );

    const score = makeEl('div', 'fracture-source-score');
    append(score, makeEl('b', '', scoreFromRows(payload, rows)), makeEl('span', '', 'Tentative matches'));
    append(head, mark, titleBlock, score);

    const body = makeEl('div', 'fracture-source-body');
    const rowSection = makeEl('div', 'fracture-source-section');
    append(rowSection, makeEl('h3', '', 'Citation checks'));
    const rowWrap = makeEl('div', 'fracture-source-rows');

    if (!rows.length) {
      append(rowWrap, makeEl('div', 'fracture-source-empty', 'No claim/source rows were returned by the verification service.'));
    } else {
      rows.forEach(function (row) {
        const rowEl = makeEl('div', 'fracture-source-row');
        const rowHead = makeEl('div', 'fracture-source-row-head');
        append(rowHead, makeEl('div', 'fracture-source-label', 'Draft passage to cite'), makeEl('div', 'fracture-source-status ' + statusTone(row.status), statusLabel(row.status)));

        const claimText = makeEl('div', 'fracture-source-text', row.claim);
        const sourceGrid = makeEl('div', 'fracture-source-grid');
        const foundCell = makeEl('div');
        append(foundCell, makeEl('div', 'fracture-source-label', 'What Fracture found'));
        if (row.sourceUrl) {
          const link = makeEl('a', 'fracture-source-link', row.sourceTitle || 'Open the closest matching source');
          link.href = row.sourceUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          append(foundCell, link);
        } else {
          append(foundCell, makeEl('div', 'fracture-source-text', row.source || 'No dependable public source was found yet.'));
        }
        if (row.note) append(foundCell, makeEl('div', 'fracture-source-note', row.note));

        const actionCell = makeEl('div');
        append(actionCell, makeEl('div', 'fracture-source-label', 'What to do next'), makeEl('div', 'fracture-source-text', nextStep(row.status)));
        if (row.issues) append(actionCell, makeEl('div', 'fracture-source-note', row.issues));

        append(sourceGrid, foundCell, actionCell);
        append(rowEl, rowHead, claimText, sourceGrid);
        append(rowWrap, rowEl);
      });
    }
    append(rowSection, rowWrap);

    const researchSection = makeEl('div', 'fracture-source-section');
    append(researchSection, makeEl('h3', '', 'Extra argument research'));
    const researchWrap = makeEl('div', 'fracture-research-grid');
    if (!researchIdeas.length) {
      append(researchWrap, makeEl('div', 'fracture-source-empty', 'No extra research leads were generated yet. Run the source check again after adding a clearer thesis or more factual claims.'));
    } else {
      researchIdeas.forEach(function (idea) {
        const ideaCard = makeEl('div', 'fracture-research-card');
        append(ideaCard, makeEl('div', 'fracture-source-label', idea.label), makeEl('strong', '', idea.title), makeEl('p', '', idea.explanation));
        const links = makeEl('div', 'fracture-research-links');
        idea.links.slice(0, 5).forEach(function (link) {
          const a = makeEl('a', '', link.title);
          a.href = link.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          if (link.note) a.title = link.note;
          append(links, a);
        });
        if (!idea.links.length) append(links, makeEl('div', 'fracture-source-note', 'No public links were found for this lead yet.'));
        append(ideaCard, links);
        append(researchWrap, ideaCard);
      });
    }
    append(researchSection, researchWrap);

    const citedSection = makeEl('div', 'fracture-source-section');
    const citedHead = makeEl('div', 'fracture-source-row-head');
    const styleSwitch = makeEl('div', 'fracture-source-style');
    styleSwitch.setAttribute('role', 'group');
    styleSwitch.setAttribute('aria-label', 'Citation style');
    ['mla', 'apa'].forEach(function (option) {
      const styleButton = makeEl('button', 'fracture-source-style-button', option.toUpperCase());
      styleButton.type = 'button';
      styleButton.setAttribute('aria-pressed', option === style ? 'true' : 'false');
      styleButton.addEventListener('click', function () {
        if (option === style) return;
        const nextPayload = Object.assign({}, payload, {
          citation_style: option,
          bibliography_title: option === 'apa' ? 'References' : 'Works Cited'
        });
        card.replaceWith(renderVerification(nextPayload));
      });
      append(styleSwitch, styleButton);
    });
    append(citedHead, makeEl('h3', '', bibliographyTitle + ' / Citation generator'), styleSwitch);
    append(citedSection, citedHead);
    if (!worksCited.length) {
      append(citedSection, makeEl('div', 'fracture-source-empty', 'No source is ready to add yet. Fracture only adds a bibliography entry for a tentative public-page match. Open the source and verify the exact passage before using it.'));
    } else {
      const list = makeEl('ol', 'fracture-works-cited');
      worksCited.forEach(function (citation) {
        append(list, makeEl('li', '', citation));
      });
      append(citedSection, list);
      const copyCitations = makeEl('button', 'fracture-source-button', 'Copy citations');
      copyCitations.type = 'button';
      copyCitations.addEventListener('click', function () {
        const textToCopy = worksCited.join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(textToCopy);
      });
      const copyWrap = makeEl('div', 'fracture-source-actions');
      append(copyWrap, copyCitations);
      append(citedSection, copyWrap);
    }

    append(body, rowSection, researchSection, citedSection);
    append(card, head, body);
    return card;
  }

  function renderMessage(message, mode) {
    injectStyles();
    const card = makeEl('section', 'fracture-source-card');
    const body = makeEl('div', 'fracture-source-body');
    append(body, makeEl('div', 'fracture-source-empty', message));
    if (mode === 'loading') {
      const note = makeEl('div', 'fracture-source-note', 'Checking sources...');
      append(body, note);
    }
    append(card, body);
    return card;
  }

  async function verifySources(getEssay, getAudit, getCitationStyle) {
    const essay = typeof getEssay === 'function' ? text(getEssay(), '') : '';
    const audit = typeof getAudit === 'function' ? getAudit() : null;
    const citationStyle = typeof getCitationStyle === 'function' && getCitationStyle() === 'apa' ? 'apa' : 'mla';
    if (!essay) throw new Error('No essay text is available for source verification.');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ essay: essay, audit: audit, citation_style: citationStyle })
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.indexOf('application/json') !== -1 ? await res.json() : { summary: await res.text() };
    if (!res.ok) throw new Error(text(payload && payload.error, 'Source verification failed.'));
    return payload;
  }

  function attach(options) {
    injectStyles();
    const config = options || {};
    const target = typeof config.targetSelector === 'string'
      ? document.querySelector(config.targetSelector)
      : config.targetSelector;

    if (!target) throw new Error('FractureSources.attach requires a valid targetSelector.');

    const root = makeEl('div', 'fracture-sources');
    const actions = makeEl('div', 'fracture-source-actions');
    const button = makeEl('button', 'fracture-source-button', 'Verify Data + Citations');
    button.type = 'button';
    append(actions, button);
    append(root, renderMessage('Verify Data + Citations is ready after an audit. It checks factual claims, finds source links, generates citations, and searches for extra argument leads.'), actions);
    target.appendChild(root);

    async function verify() {
      button.disabled = true;
      root.replaceChild(renderMessage('Verifying cited data, finding source links, generating citations, and hunting for extra argument leads.', 'loading'), root.firstChild);
      try {
        const data = await verifySources(config.getEssay, config.getAudit, config.getCitationStyle);
        root.replaceChild(renderVerification(data), root.firstChild);
        return data;
      } catch (err) {
        const message = err && err.message ? err.message : 'Source verification failed.';
        root.replaceChild(renderMessage(message), root.firstChild);
        throw err;
      } finally {
        button.disabled = false;
      }
    }

    button.addEventListener('click', verify);

    return {
      element: root,
      verify: verify,
      render: function (data) {
        root.replaceChild(renderVerification(data), root.firstChild);
      },
      clear: function () {
        root.replaceChild(renderMessage('Source verification is ready after an audit is generated.'), root.firstChild);
      },
      destroy: function () {
        button.removeEventListener('click', verify);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  window.FractureSources = {
    attach: attach,
    renderVerification: renderVerification
  };
})();
