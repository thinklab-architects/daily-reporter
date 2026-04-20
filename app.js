// 一灣苑工程日報產生器 — vanilla JS, 無 build step
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const WEEKDAYS = ['一','二','三','四','五','六','日']; // Mon..Sun

let vocab = null;

async function loadVocab() {
  const res = await fetch('vocabulary.json');
  vocab = await res.json();
  initMeta();
  addSection();
}

// ─── 基本資訊區 ───
function initMeta() {
  const rep = $('#reporter');
  rep.innerHTML = vocab.reporters.map(r => `<option value="${r}">${r}</option>`).join('');

  const w = $('#weather');
  w.innerHTML = ['<option value="">（請選）</option>']
    .concat(vocab.weather_pairs.map(([a,b]) => `<option value="${a}${b}">${a}${b}</option>`))
    .join('');

  // default to today
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  $('#date').value = iso;
  updateWeekday();

  $('#date').addEventListener('input', () => { updateWeekday(); render(); });
  $('#reporter').addEventListener('change', render);
  $('#weather').addEventListener('change', () => {
    $('#weather-custom').value = '';
    render();
  });
  $('#weather-custom').addEventListener('input', render);
}

function updateWeekday() {
  const v = $('#date').value;
  if (!v) { $('#weekday').value = ''; return; }
  const [y,m,d] = v.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  $('#weekday').value = WEEKDAYS[(dt.getDay()+6) % 7];
}

// ─── 區段（♦️） ───
function addSection(data = null) {
  const tpl = $('#section-tpl').content.cloneNode(true);
  const card = tpl.querySelector('.section-card');
  const areaSel = card.querySelector('.section-area');
  areaSel.innerHTML = vocab.areas.map(a => `<option value="${a}">${a}</option>`).join('');

  card.querySelector('.remove-btn').addEventListener('click', () => {
    card.remove();
    render();
  });
  card.querySelector('.add-item-btn').addEventListener('click', () => {
    addItem(card.querySelector('.items'));
  });
  card.addEventListener('input', render);
  card.addEventListener('change', render);

  if (data) {
    areaSel.value = data.area || vocab.areas[0];
    card.querySelector('.section-topic').value = data.topic || '';
    const itemsEl = card.querySelector('.items');
    (data.items || []).forEach(it => addItem(itemsEl, it));
  } else {
    addItem(card.querySelector('.items'));
  }
  $('#sections').appendChild(card);
  render();
}

// ─── 工項（🔹） ───
function addItem(container, data = null) {
  const tpl = $('#item-tpl').content.cloneNode(true);
  const row = tpl.querySelector('.item-row');
  const kindSel = row.querySelector('.item-kind');
  const catSel = row.querySelector('.item-category');
  const catCustom = row.querySelector('.item-category-custom');
  const unitSel = row.querySelector('.item-unit');

  unitSel.innerHTML = vocab.units.map(u => `<option value="${u}">${u}</option>`).join('');

  const populateCategories = (kind) => {
    const list = vocab.categories[kind] || [];
    catSel.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('')
      + `<option value="__custom__">＋ 自訂...</option>`;
  };
  populateCategories(kindSel.value);

  kindSel.addEventListener('change', () => {
    populateCategories(kindSel.value);
    catCustom.classList.remove('active');
    catSel.classList.remove('hidden');
    // 調整預設單位：機具→台, 材料→m3, 人力→人
    unitSel.value = {labor:'人', equipment:'台', material:'m3'}[kindSel.value] || '人';
    render();
  });
  catSel.addEventListener('change', () => {
    if (catSel.value === '__custom__') {
      catCustom.classList.add('active');
      catCustom.focus();
    } else {
      catCustom.classList.remove('active');
      catCustom.value = '';
    }
    render();
  });

  row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); render(); });
  row.addEventListener('input', render);

  if (data) {
    kindSel.value = data.kind || 'labor';
    populateCategories(kindSel.value);
    // category may be in list or custom
    if (vocab.categories[kindSel.value].includes(data.category)) {
      catSel.value = data.category;
    } else if (data.category) {
      catSel.value = '__custom__';
      catCustom.classList.add('active');
      catCustom.value = data.category;
    }
    row.querySelector('.item-count').value = data.count ?? '';
    unitSel.value = data.unit || '人';
    row.querySelector('.item-detail').value = data.detail || '';
  }
  container.appendChild(row);
}

// ─── 備註 ───
function addNote(text = '') {
  const tpl = $('#note-tpl').content.cloneNode(true);
  const row = tpl.querySelector('.note-row');
  row.querySelector('.note-text').value = text;
  row.querySelector('.remove-btn').addEventListener('click', () => { row.remove(); render(); });
  row.addEventListener('input', render);
  $('#notes').appendChild(row);
}

// ─── 蒐集資料 → 產文字 ───
function gather() {
  const date = $('#date').value;
  const weekday = $('#weekday').value;
  const reporter = $('#reporter').value;
  const weather = $('#weather-custom').value.trim() || $('#weather').value;

  const sections = $$('#sections .section-card').map(card => {
    const area = card.querySelector('.section-area').value;
    const topic = card.querySelector('.section-topic').value.trim();
    const items = $$('.item-row', card).map(row => {
      const kind = row.querySelector('.item-kind').value;
      const catSel = row.querySelector('.item-category').value;
      const catCustom = row.querySelector('.item-category-custom').value.trim();
      const category = catSel === '__custom__' ? catCustom : catSel;
      const count = row.querySelector('.item-count').value;
      const unit = row.querySelector('.item-unit').value;
      const detail = row.querySelector('.item-detail').value.trim();
      return { kind, category, count, unit, detail };
    }).filter(i => i.category && i.count !== '');
    return { area, topic, items };
  }).filter(s => s.topic || s.items.length);

  const notes = $$('#notes .note-text').map(el => el.value.trim()).filter(Boolean);
  return { date, weekday, reporter, weather, sections, notes };
}

function formatReport(d) {
  if (!d.date || !d.weekday) return '（請先選擇日期）';
  const lines = [];
  lines.push(`${d.date}（${d.weekday}）${d.weather || ''}`.trimEnd());
  for (const s of d.sections) {
    const head = s.area + (s.topic ? s.topic : '');
    lines.push(`♦️${head}`);
    for (const i of s.items) {
      const detail = i.detail ? `（${i.detail}）` : '';
      lines.push(`🔹${i.category}*${i.count}${i.unit || ''}${detail}`);
    }
  }
  for (const n of d.notes) lines.push(`💢${n}`);
  return lines.join('\n');
}

function render() {
  const data = gather();
  $('#preview').textContent = formatReport(data);
}

// ─── 工具列 ───
function initToolbar() {
  $('#add-section').addEventListener('click', () => addSection());
  $('#add-note').addEventListener('click', () => { addNote(); render(); });

  $('#copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#preview').textContent);
      flash('#copy-btn', '✓ 已複製');
    } catch { alert('複製失敗，請手動選取'); }
  });

  $('#download-json-btn').addEventListener('click', () => {
    const data = gather();
    const payload = {
      reporter: data.reporter,
      date: data.date && data.weekday ? `${data.date}（${data.weekday}）` : data.date,
      weather: data.weather,
      content: $('#preview').textContent.split('\n').slice(1),
      full_text: $('#preview').textContent,
    };
    download(`${data.date || 'report'}.json`, JSON.stringify(payload, null, 2));
  });

  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('確定清空所有欄位？')) return;
    $('#sections').innerHTML = '';
    $('#notes').innerHTML = '';
    addSection();
    render();
  });
}

function loadFrom(data) {
  if (data.date) { $('#date').value = data.date; updateWeekday(); }
  if (data.reporter) $('#reporter').value = data.reporter;
  if (data.weather) {
    const opt = [...$('#weather').options].find(o => o.value === data.weather);
    if (opt) $('#weather').value = data.weather;
    else $('#weather-custom').value = data.weather;
  }
  $('#sections').innerHTML = '';
  $('#notes').innerHTML = '';
  (data.sections || []).forEach(s => addSection(s));
  (data.notes || []).forEach(n => addNote(n));
  render();
}

function download(name, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function flash(sel, msg) {
  const el = $(sel);
  const orig = el.textContent;
  el.textContent = msg;
  setTimeout(() => { el.textContent = orig; }, 1500);
}

// ─── GitHub sync ───
let editingId = null;  // if not null, we're editing that report_id (replace instead of append)

// Classify trade kind (mirror of Python classify_kind in parse_structure.py)
function classifyKind(category) {
  if (!category) return 'other';
  const c = category;
  if (/師傅|操作手|司機|粗工|駕駛|人員/.test(c) || c === '人工' || /工$/.test(c)) return 'labor';
  if (/怪手|卡車|水車|壓送車|吊車|吊卡車|發電機|鑽孔機|灌漿組|機組|幫浦車|泵浦|全吊車|小怪手|挖土機|250|200|120/.test(c)) return 'equipment';
  if (/混凝土|kg\/cm2|280kg|140kg|210kg|水泥|紅磚|磁磚|丁掛|黏著劑|進磚|進料|化糞池/.test(c)) return 'material';
  return 'other';
}

// Build a structured entry matching data.json schema from the form.
function buildStructuredEntry(nextId) {
  const d = gather();
  const date = d.date;                       // YYYY-MM-DD
  const dateDisp = `${d.date}（${d.weekday}）`;
  const raw_text = formatReport(d);
  const sections = d.sections.map((s, si) => ({
    seq: si,
    area: s.area || null,
    topic: s.topic || null,
    header_raw: `♦️${s.area || ''}${s.topic || ''}`,
    items: s.items.map((it, ii) => ({
      category: it.category,
      count: Number(it.count),
      unit: it.unit || null,
      location: null,
      detail: it.detail || null,
      kind: it.kind || classifyKind(it.category),
      raw: `🔹${it.category}*${it.count}${it.unit || ''}${it.detail ? `（${it.detail}）` : ''}`,
      seq: ii,
    })),
  }));
  return {
    report_id: nextId,
    date, date_end: null,
    reporter: d.reporter, weather: d.weather,
    raw_text,
    sections,
    notes: d.notes,
  };
}

// Validate before submission
function validateForSubmit() {
  const d = gather();
  if (!d.date) return '請選擇日期';
  if (!d.reporter) return '請選擇回報者';
  if (!d.sections.length) return '請至少新增一個區段';
  for (const s of d.sections) {
    if (!s.items.length && !s.topic) return '每個區段請填工項描述或至少一筆工項';
  }
  return null;
}

function setSyncStatus(msg, type = '') {
  const el = $('#sync-status');
  el.textContent = msg;
  el.className = 'hint ' + type;
}

async function submitToGitHub() {
  const err = validateForSubmit();
  if (err) return setSyncStatus('✗ ' + err, 'error');
  if (!GH.getCfg().token) {
    setSyncStatus('✗ 尚未設定 GitHub Token', 'error');
    SettingsModal.open();
    return;
  }
  const isEdit = editingId !== null;
  const confirmMsg = isEdit
    ? `確定要更新 #${editingId} 這筆日報嗎？`
    : '確定要送出此日報到 GitHub？\n遠端 data.json 會追加一筆新紀錄。';
  if (!confirm(confirmMsg)) return;

  setSyncStatus('送出中…正在抓取遠端最新版本');
  try {
    const entry = buildStructuredEntry(0);  // id will be reassigned
    const msg = isEdit
      ? `Update report: ${entry.date} · ${entry.reporter}`
      : `Add report: ${entry.date} · ${entry.reporter}`;
    await GH.commit(async (remote) => {
      if (isEdit) {
        const idx = remote.findIndex(r => r.report_id === editingId);
        if (idx < 0) throw new Error(`找不到 report_id=${editingId}，可能已被他人刪除`);
        entry.report_id = editingId;
        remote[idx] = entry;
      } else {
        const dup = remote.find(r => r.date === entry.date && r.reporter === entry.reporter);
        if (dup && !confirm(`警告：${entry.date} 已有 ${entry.reporter} 的日報（#${dup.report_id}）。\n仍要新增為第二筆嗎？`)) {
          throw new Error('已取消');
        }
        remote.push(entry);
      }
      return remote;
    }, msg);
    setSyncStatus(`✓ 已${isEdit ? '更新' : '送出'} — 約 30–60 秒後重新部署完成。`, 'ok');
    if (isEdit) {
      // Go back to dashboard
      setTimeout(() => { location.href = 'dashboard.html'; }, 1500);
    }
  } catch (e) {
    if (e.message === '已取消') setSyncStatus('已取消', '');
    else setSyncStatus('✗ ' + e.message, 'error');
  }
}

// ─── Edit-mode loader ───
async function loadForEdit(id) {
  setSyncStatus(`載入 #${id} 中…`);
  try {
    const { data } = await GH.fetchRemote();
    const entry = data.find(r => r.report_id === id);
    if (!entry) throw new Error(`找不到 report_id=${id}`);
    editingId = id;
    // Convert structured entry → builder form shape and populate
    loadFrom({
      date: entry.date,
      reporter: entry.reporter,
      weather: entry.weather,
      sections: (entry.sections || []).map(s => ({
        area: s.area,
        topic: s.topic,
        items: (s.items || []).map(it => ({
          kind: it.kind || 'labor',
          category: it.category,
          count: it.count,
          unit: it.unit,
          detail: it.detail,
        })),
      })),
      notes: entry.notes || [],
    });
    $('#submit-btn').textContent = `💾 更新 #${id} 到 GitHub`;
    document.querySelector('header h1').textContent = `✏️ 編輯日報 #${id}`;
    setSyncStatus(`✓ 已載入 #${id}，修改後按「更新」送出。`, 'ok');
  } catch (e) {
    setSyncStatus('✗ ' + e.message, 'error');
  }
}

function initGitHubSync() {
  $('#submit-btn').addEventListener('click', submitToGitHub);
}

// ─── Startup ───
loadVocab().then(() => {
  initToolbar();
  initGitHubSync();
  // Check for ?edit=N
  const editId = new URLSearchParams(location.search).get('edit');
  if (editId !== null) loadForEdit(Number(editId));
});
