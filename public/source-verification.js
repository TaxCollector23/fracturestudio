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

  function statusTone(status) {
    const normalized = text(status, 'needs review').toLowerCase();
    if (/\b(verified|supported|match|accurate|pass|strong|ok)\b/.test(normalized)) return 'ok';
    if (/\b(partial|mixed|unclear|review|warning|weak)\b/.test(normalized)) return 'warn';
    if (/\b(false|unsupported|missing|failed|fabricated|mismatch|error|not found)\b/.test(normalized)) return 'bad';
    return 'warn';
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
      '.fracture-warning-triangle{position:relative;width:0;height:0;border-left:18px solid transparent;border-right:18px solid transparent;border-bottom:32px solid #ef4444;filter:drop-shadow(0 8px 16px rgba(239,68,68,.28))}',
      '.fracture-warning-triangle span{position:absolute;left:-4px;top:10px;color:white;font-size:18px;font-weight:900;line-height:1;font-family:Arial,sans-serif}',
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
      '.fracture-source-row{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(130px,.55fr) minmax(0,1fr);gap:12px;align-items:start;border:1px solid var(--border,#2c3340);border-radius:8px;padding:12px;background:rgba(255,255,255,.025)}',
      '.fracture-source-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-3,#9ca3af);font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace);margin-bottom:5px}',
      '.fracture-source-text{font-size:13px;line-height:1.45;color:var(--text-2,#cbd5e1);word-break:break-word}',
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
      '.fracture-source-note{font-size:12px;line-height:1.4;color:var(--text-3,#9ca3af);margin-top:10px}',
      '@media (max-width:720px){.fracture-source-head{grid-template-columns:auto 1fr}.fracture-source-score{grid-column:1 / -1;text-align:left}.fracture-source-row{grid-template-columns:1fr}.fracture-source-actions{justify-content:stretch}.fracture-source-button{width:100%}}',
      '[data-theme="light"] .fracture-source-card{background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(248,250,252,.88));box-shadow:0 18px 42px rgba(15,23,42,.12)}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalizeRows(data) {
    const fromRows = asArray(data && (data.rows || data.verification_rows || data.claim_source_statuses));
    if (fromRows.length) return fromRows.map(function (row) {
      return {
        claim: text(row.claim || row.text || row.statement || row.quote, 'Claim not specified.'),
        status: text(row.status || row.verdict || row.support_status, 'Needs review'),
        source: text(row.source || row.citation || row.reference || row.url || row.evidence, 'No source supplied.'),
        note: text(row.note || row.notes || row.explanation || row.issue || row.fix, '')
      };
    });

    return asArray(data && (data.claims || data.checked_claims || data.verifications)).map(function (claim) {
      const firstSource = asArray(claim.sources)[0] || {};
      const sourceLabel = text(
        claim.source || claim.citation || claim.reference || claim.url || claim.evidence ||
        firstSource.mla || firstSource.title || firstSource.url,
        'No source supplied.'
      );
      const issueText = asArray(claim.citation_issues).length
        ? 'Citation issues: ' + asArray(claim.citation_issues).join(', ') + '. '
        : '';
      return {
        claim: text(claim.claim || claim.text || claim.statement || claim.quote, 'Claim not specified.'),
        status: text(claim.status || claim.verdict || claim.support_status || claim.rating, 'Needs review'),
        source: sourceLabel,
        note: issueText + text(claim.note || claim.notes || claim.explanation || claim.issue || claim.fix || claim.verification_note, '')
      };
    });
  }

  function normalizeWorksCited(data, rows) {
    const explicit = asArray(data && (data.works_cited || data.worksCited || data.citations || data.references));
    const cited = explicit.map(function (item) {
      if (typeof item === 'string') return item.trim();
      return text(item.entry || item.citation || item.reference || item.mla || item.title || item.url || item.source, '');
    }).filter(Boolean);

    rows.forEach(function (row) {
      const source = text(row.source, '');
      if (source && source !== 'No source supplied.' && cited.indexOf(source) === -1) cited.push(source);
    });

    asArray(data && data.sources).forEach(function (item) {
      const source = typeof item === 'string' ? item.trim() : text(item.entry || item.citation || item.reference || item.mla || item.title || item.url || item.name, '');
      if (source && cited.indexOf(source) === -1) cited.push(source);
    });

    return cited;
  }

  function scoreFromRows(data, rows) {
    const explicit = data && (data.score || data.verification_score || data.source_score);
    if (explicit !== undefined && explicit !== null && explicit !== '') return text(explicit, 'Review');
    if (!rows.length) return 'Review';
    const good = rows.filter(function (row) { return statusTone(row.status) === 'ok'; }).length;
    return Math.round((good / rows.length) * 100) + '%';
  }

  function summaryText(payload) {
    if (typeof payload.summary === 'string') return payload.summary;
    if (payload.summary && typeof payload.summary === 'object') {
      const s = payload.summary;
      return [
        text(s.total_claims, '0') + ' claims checked',
        text(s.supported, '0') + ' supported',
        text(s.unsupported, '0') + ' unsupported',
        text(s.works_cited_count, '0') + ' Works Cited entries'
      ].join('. ') + '.';
    }
    return text(payload.overall || payload.verdict, 'Review each claim against the source it relies on before final submission.');
  }

  function renderVerification(data) {
    injectStyles();
    const payload = data && typeof data === 'object' ? data : {};
    const rows = normalizeRows(payload);
    const worksCited = normalizeWorksCited(payload, rows);
    const card = makeEl('section', 'fracture-source-card');
    const head = makeEl('div', 'fracture-source-head');
    const warning = append(makeEl('div', 'fracture-warning-triangle'), makeEl('span', '', '!'));
    warning.setAttribute('aria-hidden', 'true');

    const titleBlock = makeEl('div', 'fracture-source-heading');
    append(
      titleBlock,
      makeEl('div', 'fracture-source-kicker', 'Source Verification'),
      makeEl('div', 'fracture-source-title', text(payload.title, 'Claim and citation check')),
      makeEl('div', 'fracture-source-summary', summaryText(payload))
    );

    const score = makeEl('div', 'fracture-source-score');
    append(score, makeEl('b', '', scoreFromRows(payload, rows)), makeEl('span', '', 'Verified'));
    append(head, warning, titleBlock, score);

    const body = makeEl('div', 'fracture-source-body');
    const rowSection = makeEl('div', 'fracture-source-section');
    append(rowSection, makeEl('h3', '', 'Claim / Source Status'));
    const rowWrap = makeEl('div', 'fracture-source-rows');

    if (!rows.length) {
      append(rowWrap, makeEl('div', 'fracture-source-empty', 'No claim/source rows were returned by the verification service.'));
    } else {
      rows.forEach(function (row) {
        const rowEl = makeEl('div', 'fracture-source-row');
        const claimCell = makeEl('div');
        append(claimCell, makeEl('div', 'fracture-source-label', 'Claim'), makeEl('div', 'fracture-source-text', row.claim));

        const statusCell = makeEl('div');
        append(statusCell, makeEl('div', 'fracture-source-label', 'Status'), makeEl('div', 'fracture-source-status ' + statusTone(row.status), row.status));

        const sourceCell = makeEl('div');
        append(sourceCell, makeEl('div', 'fracture-source-label', 'Source'), makeEl('div', 'fracture-source-text', row.source));
        if (row.note) append(sourceCell, makeEl('div', 'fracture-source-note', row.note));

        append(rowEl, claimCell, statusCell, sourceCell);
        append(rowWrap, rowEl);
      });
    }
    append(rowSection, rowWrap);

    const citedSection = makeEl('div', 'fracture-source-section');
    append(citedSection, makeEl('h3', '', 'Works Cited'));
    if (!worksCited.length) {
      append(citedSection, makeEl('div', 'fracture-source-empty', 'Works Cited will populate when citations or source references are returned.'));
    } else {
      const list = makeEl('ol', 'fracture-works-cited');
      worksCited.forEach(function (citation) {
        append(list, makeEl('li', '', citation));
      });
      append(citedSection, list);
    }

    append(body, rowSection, citedSection);
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

  async function verifySources(getEssay, getAudit) {
    const essay = typeof getEssay === 'function' ? text(getEssay(), '') : '';
    const audit = typeof getAudit === 'function' ? getAudit() : null;
    if (!essay) throw new Error('No essay text is available for source verification.');

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ essay: essay, audit: audit })
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
    const button = makeEl('button', 'fracture-source-button', 'Verify Sources');
    button.type = 'button';
    append(actions, button);
    append(root, renderMessage('Source verification is ready after an audit is generated.'), actions);
    target.appendChild(root);

    async function verify() {
      button.disabled = true;
      root.replaceChild(renderMessage('Preparing source verification.', 'loading'), root.firstChild);
      try {
        const data = await verifySources(config.getEssay, config.getAudit);
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
