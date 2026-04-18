// 工程日報產生器 — vanilla JS, 無 build step
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const WEEKDAYS = ['一','二','三','四','五','六','日']; // Mon..Sun
const DRAFT_KEY = 'report-builder:draft';

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

  $('#download-txt-btn').addEventListener('click', () => {
    const data = gather();
    download(`${data.date || 'report'}.txt`, $('#preview').textContent);
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

  $('#save-draft-btn').addEventListener('click', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(gather()));
    flash('#save-draft-btn', '✓ 草稿已存');
  });
  $('#load-draft-btn').addEventListener('click', () => {
    const s = localStorage.getItem(DRAFT_KEY);
    if (!s) return alert('沒有找到草稿。');
    loadFrom(JSON.parse(s));
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

// ─── Startup ───
loadVocab().then(initToolbar);
