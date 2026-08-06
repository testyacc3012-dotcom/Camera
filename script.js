// Derelict — scans Roblox's public group search API for groups with no owner.
// Uses only public, unauthenticated GET endpoints. No login, no bypass, no write actions.

const els = {
  keyword: document.getElementById('keywordInput'),
  btnScan: document.getElementById('btnScan'),
  btnStop: document.getElementById('btnStop'),
  log: document.getElementById('scanLog'),
  results: document.getElementById('resultsTable'),
  statScanned: document.getElementById('statScanned'),
  statFound: document.getElementById('statFound'),
  statStatus: document.getElementById('statStatus'),
  groupIdInput: document.getElementById('groupIdInput'),
  btnCheck: document.getElementById('btnCheck'),
  manualResult: document.getElementById('manualResult'),
  proxyInput: document.getElementById('proxyInput'),
  btnSaveProxy: document.getElementById('btnSaveProxy'),
  proxyStatus: document.getElementById('proxyStatus'),
  progressWrap: document.getElementById('progressWrap'),
  progressLabel: document.getElementById('progressLabel'),
  progressPct: document.getElementById('progressPct'),
  progressFill: document.getElementById('progressFill'),
};

const MAX_LOG_LINES = 200;      // trim old log entries past this to keep memory/DOM light
const CHECK_DELAY_MS = 300;     // pause between each per-group detail check
const PAGE_DELAY_MS = 700;      // pause between search result pages

let state = {
  scanning: false,
  stopRequested: false,
  scannedCount: 0,
  foundIds: new Set(),
  cycle: 0,
};

// ---------- Proxy handling ----------

const savedProxy = localStorage.getItem('derelict_proxy') || '';
els.proxyInput.value = savedProxy;
updateProxyStatus();

els.btnSaveProxy.addEventListener('click', () => {
  const val = els.proxyInput.value.trim();
  localStorage.setItem('derelict_proxy', val);
  updateProxyStatus();
});

function updateProxyStatus() {
  const val = localStorage.getItem('derelict_proxy') || '';
  els.proxyStatus.textContent = val
    ? `Routing requests through: ${val}`
    : 'No proxy set — requesting Roblox directly.';
}

function buildUrl(rawUrl) {
  const proxy = localStorage.getItem('derelict_proxy') || '';
  if (!proxy) return rawUrl;
  return proxy + encodeURIComponent(rawUrl);
}

// ---------- Logging ----------
// Capped + trimmed so a long-running scan can't balloon memory or make the
// page sluggish. Oldest lines get dropped once we're past MAX_LOG_LINES.

function logLine(html, isFound = false) {
  if (els.log.querySelector('.log-empty')) els.log.innerHTML = '';
  const line = document.createElement('div');
  line.className = isFound ? 'log-line found' : 'log-line';
  line.innerHTML = html;
  els.log.appendChild(line);

  while (els.log.children.length > MAX_LOG_LINES) {
    els.log.removeChild(els.log.firstChild);
  }

  els.log.scrollTop = els.log.scrollHeight;
}

// ---------- Stats ----------

function updateStats() {
  els.statScanned.textContent = state.scannedCount;
  els.statFound.textContent = state.foundIds.size;
  els.statStatus.textContent = state.scanning ? 'scanning' : 'idle';
}

function updateProgress(label, pct) {
  els.progressWrap.style.display = 'block';
  els.progressLabel.textContent = label;
  els.progressPct.textContent = `${pct}%`;
  els.progressFill.style.width = `${pct}%`;
}

// ---------- Results rendering ----------

function addResultRow(group) {
  if (els.results.querySelector('.results-empty')) els.results.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'result-row';
  row.innerHTML = `
    <div>
      <span class="result-name">${escapeHtml(group.name)}</span>
      <span class="result-id">ID ${group.id}</span>
    </div>
    <span class="result-members">${group.memberCount ?? '?'} members</span>
    <span class="badge">no owner</span>
    <a class="result-link" href="https://www.roblox.com/groups/${group.id}" target="_blank" rel="noopener">View on Roblox ↗</a>
  `;
  els.results.appendChild(row);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Core search ----------
// Paginated (cursor-based) instead of one fixed batch of 100, so a single
// keyword can be walked page by page rather than truncated at one call.

async function searchKeywordPage(keyword, cursor) {
  const url = `https://groups.roblox.com/v1/groups/search?keyword=${encodeURIComponent(keyword)}&limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  const res = await fetch(buildUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// The search endpoint does NOT include real owner info - it's missing from
// the response entirely, which used to get misread as "ownerless" for every
// result. The only endpoint that actually reports owner status is the
// per-group detail endpoint, so each candidate has to be verified there.
async function getGroupDetail(id) {
  const url = `https://groups.roblox.com/v1/groups/${id}`;
  const res = await fetch(buildUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Runs forever, cycling through the keyword list and paging through each
// one's full result set, until Stop is pressed. Throttled between every
// single check so it never hammers the API/proxy or freezes the tab.
async function runContinuousScan(keywords) {
  state.scanning = true;
  state.stopRequested = false;
  state.cycle = 0;
  els.btnScan.disabled = true;
  els.btnStop.disabled = false;
  updateStats();

  outer:
  while (!state.stopRequested) {
    state.cycle++;

    for (const kw of keywords) {
      if (state.stopRequested) break outer;
      let cursor = '';
      let pageNum = 0;

      do {
        if (state.stopRequested) break outer;
        pageNum++;

        let page;
        try {
          page = await searchKeywordPage(kw, cursor);
        } catch (err) {
          logLine(`<span class="tag-warn">request failed</span> on "${escapeHtml(kw)}" (${escapeHtml(err.message)}). Likely a CORS block — see "Connection settings" below.`);
          await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
          break; // give up on this keyword for now, move to the next
        }

        const groups = page.data || [];
        cursor = page.nextPageCursor || '';

        for (let i = 0; i < groups.length; i++) {
          if (state.stopRequested) break outer;
          const g = groups[i];
          state.scannedCount++;

          const pct = groups.length ? Math.round(((i + 1) / groups.length) * 100) : 100;
          updateProgress(`cycle ${state.cycle} · "${kw}" · page ${pageNum}`, pct);

          logLine(`checking <span class="tag">#${g.id}</span> "${escapeHtml(g.name)}"…`);

          let detail;
          try {
            detail = await getGroupDetail(g.id);
          } catch (e) {
            logLine(`&nbsp;&nbsp;→ <span class="tag-warn">verify failed</span>, skipping`);
            await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
            continue;
          }

          if (detail.owner === null && !state.foundIds.has(g.id)) {
            state.foundIds.add(g.id);
            addResultRow(detail);
            updateStats();
            logLine(`⚠ OWNERLESS: "${escapeHtml(detail.name)}" — #${g.id} — ${detail.memberCount} members`, true);
            // Pause the scan and surface it immediately rather than letting
            // it scroll past in the log.
            alert(`Ownerless group found!\n\n${detail.name}\nID: ${g.id}\nMembers: ${detail.memberCount}\n\nScan will resume once you close this.`);
          }

          updateStats();
          await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
        }

        await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
      } while (cursor && !state.stopRequested);
    }

    logLine(`<span class="tag">cycle ${state.cycle} complete</span> — looping back to keep monitoring…`);
  }

  state.scanning = false;
  els.btnScan.disabled = false;
  els.btnStop.disabled = true;
  updateStats();
  logLine('<span class="tag-warn">scan stopped</span>');
}

els.btnScan.addEventListener('click', () => {
  const raw = els.keyword.value.trim();
  if (!raw) return;
  const keywords = raw.split(',').map(k => k.trim()).filter(Boolean);
  runContinuousScan(keywords);
});

els.btnStop.addEventListener('click', () => {
  state.stopRequested = true;
});

// ---------- Manual group check ----------

els.btnCheck.addEventListener('click', async () => {
  const id = els.groupIdInput.value.trim();
  if (!/^\d+$/.test(id)) {
    els.manualResult.innerHTML = `<span class="warn">Enter a numeric group ID.</span>`;
    return;
  }
  els.manualResult.innerHTML = `<span class="warn">checking…</span>`;
  try {
    const url = `https://groups.roblox.com/v1/groups/${id}`;
    const res = await fetch(buildUrl(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const g = await res.json();
    const ownerless = g.owner === null;
    els.manualResult.innerHTML = ownerless
      ? `<span class="ok">✓ "${escapeHtml(g.name)}" (${g.memberCount} members) has no owner.</span> <a class="result-link" href="https://www.roblox.com/groups/${id}" target="_blank" rel="noopener">View ↗</a>`
      : `<span class="no">✗ "${escapeHtml(g.name)}" is owned by ${escapeHtml(g.owner.username)}.</span>`;
  } catch (err) {
    els.manualResult.innerHTML = `<span class="warn">Request failed (${escapeHtml(err.message)}). Try setting a CORS proxy below.</span>`;
  }
});
