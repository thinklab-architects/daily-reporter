// Shared GitHub settings modal — used on index, dashboard, reports pages.
// Depends on window.GH (github-sync.js) being loaded first.
// On DOMContentLoaded: inject the modal HTML into <body> and wire up the ⚙️ button.
(function () {
  const MODAL_HTML = `
    <div id="settings-modal" class="modal-backdrop hidden">
      <div class="modal">
        <h2>⚙️ GitHub 連線設定</h2>
        <p class="hint">
          送出日報時會直接 commit 到 repo 的 <code>data.json</code>，GitHub Actions 會自動重新部署。<br>
          Token 只儲存在你的瀏覽器 localStorage，不會上傳到任何伺服器。
        </p>
        <label>Owner / Repo
          <input type="text" id="cfg-repo" placeholder="thinklab-architects/daily-reporter" />
        </label>
        <label>Branch
          <input type="text" id="cfg-branch" placeholder="main" />
        </label>
        <label>檔案路徑
          <input type="text" id="cfg-path" placeholder="data.json" />
        </label>
        <label>Personal Access Token
          <input type="password" id="cfg-token" placeholder="github_pat_..." autocomplete="new-password" />
        </label>
        <p class="hint">
          建議用 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank">fine-grained token</a>，
          權限只給此 repo 的 <code>Contents: Read and Write</code>。
        </p>
        <div class="toolbar">
          <button id="cfg-test">🔍 測試連線</button>
          <button id="cfg-save" class="primary-cta">💾 儲存設定</button>
          <button id="cfg-clear" class="danger">🗑️ 清除</button>
          <button id="cfg-close">關閉</button>
        </div>
        <p id="cfg-status" class="hint"></p>
      </div>
    </div>
  `;

  function $(s) { return document.querySelector(s); }

  function loadIntoModal() {
    const c = GH.getCfg();
    $('#cfg-repo').value = c.repo;
    $('#cfg-branch').value = c.branch;
    $('#cfg-path').value = c.path;
    $('#cfg-token').value = c.token;
  }
  function readFromModal() {
    return {
      repo: $('#cfg-repo').value.trim() || GH.DEFAULT_CFG.repo,
      branch: $('#cfg-branch').value.trim() || GH.DEFAULT_CFG.branch,
      path: $('#cfg-path').value.trim() || GH.DEFAULT_CFG.path,
      token: $('#cfg-token').value.trim(),
    };
  }
  function setStatus(msg, type = '') {
    const el = $('#cfg-status');
    el.textContent = msg;
    el.className = 'hint ' + type;
  }
  function open() {
    loadIntoModal();
    setStatus('');
    $('#settings-modal').classList.remove('hidden');
  }
  function close() { $('#settings-modal').classList.add('hidden'); }

  async function test() {
    const cfg = readFromModal();
    if (!cfg.token) return setStatus('請先填入 Token', 'error');
    const prev = GH.getCfg();
    GH.setCfg(cfg);
    setStatus('測試中…');
    try {
      const { data } = await GH.fetchRemote();
      if (!Array.isArray(data)) throw new Error('遠端檔案不是 JSON 陣列');
      setStatus(`✓ 連線成功，遠端有 ${data.length} 筆資料。`, 'ok');
    } catch (e) {
      GH.setCfg(prev);
      setStatus(`✗ ${e.message}`, 'error');
    }
  }

  function init() {
    if (!$('#settings-modal')) {
      const host = document.createElement('div');
      host.innerHTML = MODAL_HTML.trim();
      document.body.appendChild(host.firstChild);
    }
    const btn = $('#open-settings');
    if (btn) btn.addEventListener('click', open);

    $('#cfg-close').addEventListener('click', close);
    $('#settings-modal').addEventListener('click', e => {
      if (e.target.id === 'settings-modal') close();
    });
    $('#cfg-save').addEventListener('click', () => {
      GH.setCfg(readFromModal());
      setStatus('✓ 已儲存', 'ok');
    });
    $('#cfg-test').addEventListener('click', test);
    $('#cfg-clear').addEventListener('click', () => {
      if (!confirm('確定清除儲存的 Token？')) return;
      GH.clearCfg();
      loadIntoModal();
      setStatus('已清除', '');
    });
  }

  // Expose API for page-specific callers (e.g. builder auto-opens on missing token)
  window.SettingsModal = { open, close };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
