// 工程日報列表頁 — 讀 data.json，提供篩選、搜尋、展開、編輯、刪除
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const WD = '一二三四五六日';

let RAW = [];

(async function init() {
  const res = await fetch('data.json');
  RAW = await res.json();
  $('#subtitle').textContent = `共 ${RAW.length} 份日報（${firstDate(RAW)} ～ ${lastDate(RAW)}）`;
  populateFilters();
  $$('#f-start, #f-end, #f-area, #f-reporter, #f-weather').forEach(el =>
    el.addEventListener('change', renderTable));
  $('#search').addEventListener('input', renderTable);
  $('#f-reset').addEventListener('click', () => {
    $('#f-start').value = $('#f-end').value = '';
    $('#f-area').value = $('#f-reporter').value = $('#f-weather').value = '';
    $('#search').value = '';
    renderTable();
  });
  renderTable();
})();

function firstDate(rows) { return (rows.find(r => r.date) || {}).date || '—'; }
function lastDate(rows) { return [...rows].reverse().find(r => r.date)?.date || '—'; }

function populateFilters() {
  const areas = new Set(), reporters = new Set(), weathers = new Set();
  for (const r of RAW) {
    if (r.reporter) reporters.add(r.reporter);
    if (r.weather) weathers.add(r.weather);
    for (const s of r.sections || []) if (s.area) areas.add(s.area);
  }
  $('#f-area').innerHTML += [...areas].sort().map(a => `<option>${a}</option>`).join('');
  $('#f-reporter').innerHTML += [...reporters].sort().map(a => `<option>${a}</option>`).join('');
  $('#f-weather').innerHTML += [...weathers].sort().map(w => `<option>${w}</option>`).join('');
}

function filtered() {
  const start = $('#f-start').value, end = $('#f-end').value;
  const area = $('#f-area').value, rep = $('#f-reporter').value, wea = $('#f-weather').value;
  const q = $('#search').value.trim().toLowerCase();
  return RAW.filter(r => {
    if (!r.date) return false;
    if (start && r.date < start) return false;
    if (end && r.date > end) return false;
    if (rep && r.reporter !== rep) return false;
    if (wea && r.weather !== wea) return false;
    if (area && !(r.sections || []).some(s => s.area === area)) return false;
    if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
    return true;
  });
}

function sumKind(r, kind) {
  return (r.sections || []).flatMap(s => s.items || [])
    .filter(i => i.kind === kind && i.count != null)
    .reduce((a, b) => a + (+b.count || 0), 0);
}

function renderTable() {
  const rows = filtered().slice().reverse();
  $('#count-hint').textContent = `顯示 ${rows.length} 筆（共 ${RAW.length} 筆）`;
  const tbody = $('#reports-table tbody');
  tbody.innerHTML = rows.map(r => {
    const wd = r.date ? WD[(new Date(r.date).getDay()+6) % 7] : '';
    const labor = sumKind(r, 'labor');
    const equip = sumKind(r, 'equipment');
    const summary = (r.sections || []).map(s =>
      `${s.area || ''}${(s.topic || '').slice(0, 18)}`).join(' · ');
    const id = r.report_id ?? -1;
    return `<tr class="expandable" data-id="${id}">
      <td>${id}</td>
      <td>${r.date || ''}</td>
      <td>${wd}</td>
      <td>${r.reporter || ''}</td>
      <td>${r.weather || ''}</td>
      <td>${(r.sections || []).length}</td>
      <td>${labor || ''}</td>
      <td>${equip || ''}</td>
      <td class="summary">${summary}</td>
      <td class="row-actions">
        <button class="icon-btn edit" title="編輯" data-act="edit" data-id="${id}">✏️</button>
        <button class="icon-btn delete" title="刪除" data-act="delete" data-id="${id}">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function renderDetail(r) {
  const sections = (r.sections || []).map(s => {
    const items = (s.items || []).map(it => {
      const kindIcon = { labor: '👷', equipment: '🚜', material: '📦' }[it.kind] || '🔹';
      const cnt = it.count != null ? `${it.count}${it.unit || ''}` : '';
      const detail = it.detail ? `（${it.detail}）` : '';
      return `<li>${kindIcon} ${it.category || ''} ${cnt}${detail}</li>`;
    }).join('');
    return `<div class="detail-section">
      <strong>♦️ ${s.area || ''}｜${s.topic || ''}</strong>
      <ul>${items || '<li class="muted">（無工項）</li>'}</ul>
    </div>`;
  }).join('');
  const notes = (r.notes || []).map(n => `<li>💢 ${n.text || n}</li>`).join('');
  return `<td colspan="10" class="detail-cell">
    <div class="detail-wrap">
      ${sections || '<p class="muted">（無區段）</p>'}
      ${notes ? `<div class="detail-section"><strong>備註</strong><ul>${notes}</ul></div>` : ''}
    </div>
  </td>`;
}

// ─── Row expand toggle ───
document.addEventListener('click', (e) => {
  if (e.target.closest('button.icon-btn')) return; // ignore action buttons
  const row = e.target.closest('tr.expandable');
  if (!row) return;
  const id = Number(row.dataset.id);
  const next = row.nextElementSibling;
  if (next && next.classList.contains('detail-row')) {
    next.remove();
    row.classList.remove('expanded');
    return;
  }
  const r = RAW.find(x => x.report_id === id);
  if (!r) return;
  const detailRow = document.createElement('tr');
  detailRow.className = 'detail-row';
  detailRow.innerHTML = renderDetail(r);
  row.after(detailRow);
  row.classList.add('expanded');
});

// ─── Edit / Delete actions ───
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.icon-btn');
  if (!btn) return;
  e.stopPropagation();
  const id = Number(btn.dataset.id);
  if (btn.dataset.act === 'edit') {
    location.href = `index.html?edit=${id}`;
    return;
  }
  if (btn.dataset.act === 'delete') {
    const row = RAW.find(r => r.report_id === id);
    if (!row) return alert('找不到該筆資料');
    if (!GH.getCfg().token) {
      alert('請先到日報輸入頁 ⚙️ 設定 GitHub Token 才能刪除。');
      return;
    }
    if (!confirm(`確定刪除 #${id}（${row.date} · ${row.reporter}）？\n此動作會直接 commit 到 GitHub。`)) return;
    btn.disabled = true; btn.textContent = '⏳';
    try {
      const newArr = await GH.commit(
        (remote) => remote.filter(r => r.report_id !== id),
        `Delete report #${id}: ${row.date} · ${row.reporter}`
      );
      RAW = newArr;
      renderTable();
      alert(`✓ 已刪除。遠端 Actions 會在 30–60 秒內重新部署。`);
    } catch (err) {
      alert('✗ 刪除失敗：' + err.message);
      btn.disabled = false; btn.textContent = '🗑️';
    }
  }
});
