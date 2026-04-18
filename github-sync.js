// Shared GitHub API helpers. Loaded on both index.html and dashboard.html.
// Exposes global `GH` namespace.
(function (global) {
  const CFG_KEY = 'report-builder:github-cfg';
  const DEFAULT_CFG = {
    repo: 'thinklab-architects/daily-reporter',
    branch: 'main',
    path: 'data.json',
    token: '',
  };

  function getCfg() {
    const saved = localStorage.getItem(CFG_KEY);
    return { ...DEFAULT_CFG, ...(saved ? JSON.parse(saved) : {}) };
  }
  function setCfg(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
  function clearCfg() { localStorage.removeItem(CFG_KEY); }

  // base64 encode UTF-8 string (btoa is Latin-1 only)
  function utf8ToB64(s) {
    const bytes = new TextEncoder().encode(s);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
  function b64ToUtf8(b) {
    const binary = atob(b.replace(/\s/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function apiGet(cfg) {
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${cfg.token}`,
      },
    });
    if (!r.ok) throw new Error(`GET failed: ${r.status} ${r.statusText}`);
    return r.json();
  }
  async function apiPut(cfg, contentB64, sha, message) {
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, content: contentB64, sha, branch: cfg.branch }),
    });
    if (!r.ok) throw new Error(`PUT failed: ${r.status} ${r.statusText} ${await r.text()}`);
    return r.json();
  }

  // High-level: mutate the remote array via a callback that returns new array.
  // Returns the new array, after a successful commit.
  async function commit(mutate, commitMsg) {
    const cfg = getCfg();
    if (!cfg.token) throw new Error('尚未設定 GitHub Token — 請到 ⚙️ 設定');
    const file = await apiGet(cfg);
    const arr = JSON.parse(b64ToUtf8(file.content));
    const newArr = await mutate(arr);
    newArr.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // Re-index report_id to be contiguous after sort
    newArr.forEach((r, i) => r.report_id = i);
    const txt = JSON.stringify(newArr, null, 2);
    await apiPut(cfg, utf8ToB64(txt), file.sha, commitMsg);
    return newArr;
  }

  async function fetchRemote() {
    const cfg = getCfg();
    if (!cfg.token) throw new Error('尚未設定 Token');
    const file = await apiGet(cfg);
    return { data: JSON.parse(b64ToUtf8(file.content)), sha: file.sha };
  }

  global.GH = {
    getCfg, setCfg, clearCfg,
    utf8ToB64, b64ToUtf8, apiGet, apiPut,
    commit, fetchRemote, CFG_KEY, DEFAULT_CFG,
  };
})(window);
