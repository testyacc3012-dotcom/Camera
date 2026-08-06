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
};

let state = {
  scanning: false,
  stopRequested: false,
  scannedCount: 0,
  foundIds: new Set(),
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

function logLine(html) {
  if (els.log.querySelector('.log-empty')) els.log.innerHTML = '';
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = html;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
}

// ---------- Stats ----------

function updateStats() {
  els.statScanned.textContent = state.scannedCount;
  els.statFound.textContent = state.foundIds.size;
  els.statStatus.textContent = state.scanning ? 'sweeping' : 'idle';
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

async function searchKeyword(keyword) {
  const url = `https://groups.roblox.com/v1/groups/search?keyword=${encodeURIComponent(keyword)}&limit=100`;
  const res = await fetch(buildUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data || [];
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

async function runSweep(keywords) {
  state.scanning = true;
  state.stopRequested = false;
  els.btnScan.disabled = true;
  els.btnStop.disabled = false;
  updateStats();

  for (const kw of keywords) {
    if (state.stopRequested) break;
    logLine(`<span class="tag">scanning</span> keyword "${escapeHtml(kw)}"…`);

    try {
      const groups = await searchKeyword(kw);
      logLine(`&nbsp;&nbsp;→ ${groups.length} results, verifying owner status one by one…`);

      let hits = 0;
      for (const g of groups) {
        if (state.stopRequested) break;
        state.scannedCount++;

        let detail;
        try {
          detail = await getGroupDetail(g.id);
        } catch (e) {
          continue; // skip ones that fail to verify rather than guessing
        }

        const isOwnerless = detail.owner === null;
        if (isOwnerless && !state.foundIds.has(g.id)) {
          state.foundIds.add(g.id);
          addResultRow(detail);
          hits++;
        }
        updateStats();
        await new Promise(r => setTimeout(r, 250)); // stay easy on the proxy/API
      }
      logLine(`&nbsp;&nbsp;→ verified all, <span class="tag">${hits} genuinely ownerless</span> in "${escapeHtml(kw)}"`);
    } catch (err) {
      logLine(`&nbsp;&nbsp;→ <span class="tag-warn">request failed</span> (${escapeHtml(err.message)}). Likely a CORS block — see the "Connection settings" panel below.`);
    }

    updateStats();
    // Small delay between requests to stay easy on the API
    await new Promise(r => setTimeout(r, 600));
  }

  state.scanning = false;
  els.btnScan.disabled = false;
  els.btnStop.disabled = true;
  updateStats();
  logLine(state.stopRequested ? '<span class="tag-warn">sweep stopped</span>' : '<span class="tag">sweep complete</span>');
}

els.btnScan.addEventListener('click', () => {
  const raw = els.keyword.value.trim();
  if (!raw) return;
  const keywords = raw.split(',').map(k => k.trim()).filter(Boolean);
  runSweep(keywords);
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
