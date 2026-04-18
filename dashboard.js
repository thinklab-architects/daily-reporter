// 工程日報統計儀表板 — 讀 data.json，用 Chart.js 畫圖
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const WD = '一二三四五六日';
const PALETTE = ['#2f6feb','#43b581','#faa61a','#d64545','#9b59b6','#17a2b8','#e67e22','#34495e','#16a085','#c0392b'];
const CONCRETE_RE = /kg\/cm2|混凝土/i;
const M3_RE = /m3|M3|立方/i;

let RAW = [];       // full dataset
let CHARTS = {};    // chart instances

(async function init() {
  const res = await fetch('data.json');
  RAW = await res.json();
  $('#subtitle').textContent = `共 ${RAW.length} 份日報（${firstDate(RAW)} ～ ${lastDate(RAW)}）`;
  populateFilters();
  $$('#f-start, #f-end, #f-area, #f-reporter').forEach(el =>
    el.addEventListener('change', renderAll));
  $('#f-reset').addEventListener('click', () => {
    $('#f-start').value = $('#f-end').value = '';
    $('#f-area').value = $('#f-reporter').value = '';
    renderAll();
  });
  $('#search').addEventListener('input', renderTable);
  renderAll();
})();

function firstDate(rows) { return (rows.find(r => r.date) || {}).date || '—'; }
function lastDate(rows) { return [...rows].reverse().find(r => r.date)?.date || '—'; }

function populateFilters() {
  const areas = new Set(), reporters = new Set();
  for (const r of RAW) {
    if (r.reporter) reporters.add(r.reporter);
    for (const s of r.sections || []) if (s.area) areas.add(s.area);
  }
  $('#f-area').innerHTML += [...areas].sort().map(a => `<option>${a}</option>`).join('');
  $('#f-reporter').innerHTML += [...reporters].sort().map(a => `<option>${a}</option>`).join('');
}

function filtered() {
  const start = $('#f-start').value, end = $('#f-end').value;
  const area = $('#f-area').value, rep = $('#f-reporter').value;
  return RAW.filter(r => {
    if (!r.date) return false;
    if (start && r.date < start) return false;
    if (end && r.date > end) return false;
    if (rep && r.reporter !== rep) return false;
    if (area) {
      if (!(r.sections || []).some(s => s.area === area)) return false;
    }
    return true;
  });
}

function ym(d) { return (d || '').slice(0, 7); }

// ─── 聚合函式 ───
function flatItems(rows, pred = () => true) {
  const out = [];
  for (const r of rows) for (const s of r.sections || []) {
    const area = $('#f-area').value;
    if (area && s.area !== area) continue;
    for (const it of s.items || []) {
      if (it.count == null) continue;
      if (!pred(it, s, r)) continue;
      out.push({ ...it, area: s.area, date: r.date, ym: ym(r.date), reporter: r.reporter });
    }
  }
  return out;
}

function sumBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + (+r.count || 0));
  }
  return m;
}

// ─── Render all ───
function renderAll() {
  const rows = filtered();
  renderKPI(rows);
  renderLabor(rows);
  renderTrend(rows);
  renderAreaStack(rows);
  renderWeather(rows);
  renderReporter(rows);
  renderEquipment(rows);
  renderConcrete(rows);
  renderTable();
}

// ─── KPI cards ───
function renderKPI(rows) {
  const items = flatItems(rows);
  const labor = items.filter(i => i.kind === 'labor');
  const equipment = items.filter(i => i.kind === 'equipment');
  const totalLabor = labor.reduce((a, b) => a + (+b.count || 0), 0);
  const months = new Set(rows.map(r => ym(r.date)).filter(Boolean));
  const concrete = items.filter(i => CONCRETE_RE.test(i.category || '') && M3_RE.test(i.unit || ''))
                        .reduce((a, b) => a + (+b.count || 0), 0);
  const cards = [
    ['📄 日報數', rows.length],
    ['👷 累計人日', totalLabor.toLocaleString(undefined,{maximumFractionDigits:1})],
    ['🚜 機具台次', equipment.reduce((a,b)=>a+(+b.count||0),0).toLocaleString(undefined,{maximumFractionDigits:1})],
    ['🏗️ 混凝土 m³', concrete.toLocaleString(undefined,{maximumFractionDigits:1})],
    ['📅 涵蓋月數', months.size],
    ['🙋 回報者數', new Set(rows.map(r => r.reporter)).size],
  ];
  $('#kpi-grid').innerHTML = cards.map(([t, v]) =>
    `<div class="kpi-card"><div class="kpi-label">${t}</div><div class="kpi-value">${v}</div></div>`
  ).join('');
}

// ─── Chart helpers ───
function drawChart(id, config) {
  if (CHARTS[id]) CHARTS[id].destroy();
  CHARTS[id] = new Chart($(id).getContext('2d'), config);
}

// ─── 工種累計前 15 ───
function renderLabor(rows) {
  const labor = flatItems(rows, i => i.kind === 'labor');
  const sums = sumBy(labor, i => i.category || '(未知)');
  const top = [...sums.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 15);
  drawChart('#chart-labor', {
    type: 'bar',
    data: {
      labels: top.map(t => t[0]),
      datasets: [{ label: '人日', data: top.map(t => t[1]), backgroundColor: '#2f6feb' }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
}

// ─── 主要工種每月趨勢 ───
function renderTrend(rows) {
  const labor = flatItems(rows, i => i.kind === 'labor');
  const groups = {
    '板模系': c => /板模|模板|模版/.test(c),
    '水電': c => /水電/.test(c),
    '鋼筋': c => /鋼筋|紮筋/.test(c),
    '防水': c => /防水/.test(c),
    '打底/砌磚': c => /打底|砌磚/.test(c),
  };
  const months = [...new Set(labor.map(i => i.ym).filter(Boolean))].sort();
  const datasets = Object.entries(groups).map(([name, pred], i) => {
    const data = months.map(m =>
      labor.filter(it => it.ym === m && pred(it.category || '')).reduce((a,b)=>a+(+b.count||0),0));
    return {
      label: name, data, borderColor: PALETTE[i],
      backgroundColor: PALETTE[i] + '33', tension: 0.3, fill: false,
    };
  });
  drawChart('#chart-trend', {
    type: 'line',
    data: { labels: months, datasets },
    options: {
      interaction: { mode: 'index' },
      scales: { y: { beginAtZero: true, title: { display: true, text: '人日' } } }
    }
  });
}

// ─── 區域每月人日 stacked ───
function renderAreaStack(rows) {
  const labor = flatItems(rows, i => i.kind === 'labor');
  const months = [...new Set(labor.map(i => i.ym).filter(Boolean))].sort();
  const areas = [...new Set(labor.map(i => i.area).filter(Boolean))];
  const datasets = areas.map((a, i) => ({
    label: a,
    data: months.map(m =>
      labor.filter(it => it.ym === m && it.area === a).reduce((s,b)=>s+(+b.count||0),0)),
    backgroundColor: PALETTE[i % PALETTE.length],
    stack: 'area',
  }));
  drawChart('#chart-area', {
    type: 'bar',
    data: { labels: months, datasets },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: '人日' } }
      }
    }
  });
}

// ─── 天氣 pie ───
function renderWeather(rows) {
  const c = new Map();
  for (const r of rows) {
    const w = (r.weather || '(無)').slice(0, 20);
    c.set(w, (c.get(w) || 0) + 1);
  }
  const top = [...c.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 8);
  drawChart('#chart-weather', {
    type: 'doughnut',
    data: { labels: top.map(t=>t[0]), datasets: [{ data: top.map(t=>t[1]), backgroundColor: PALETTE }] },
    options: { plugins: { legend: { position: 'right' } } }
  });
}

// ─── 回報者 pie ───
function renderReporter(rows) {
  const c = new Map();
  for (const r of rows) c.set(r.reporter || '(匿名)', (c.get(r.reporter || '(匿名)') || 0) + 1);
  const arr = [...c.entries()].sort((a,b)=>b[1]-a[1]);
  drawChart('#chart-reporter', {
    type: 'doughnut',
    data: { labels: arr.map(t=>t[0]), datasets: [{ data: arr.map(t=>t[1]), backgroundColor: PALETTE }] },
    options: { plugins: { legend: { position: 'right' } } }
  });
}

// ─── 機具 bar ───
function renderEquipment(rows) {
  const eq = flatItems(rows, i => i.kind === 'equipment');
  const sums = sumBy(eq, i => i.category || '(未知)');
  const top = [...sums.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 12);
  drawChart('#chart-equipment', {
    type: 'bar',
    data: {
      labels: top.map(t => t[0]),
      datasets: [{ label: '累計台次', data: top.map(t => t[1]), backgroundColor: '#faa61a' }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } },
               scales: { x: { beginAtZero: true } } }
  });
}

// ─── 混凝土 m³ bar ───
function renderConcrete(rows) {
  const items = flatItems(rows, i => CONCRETE_RE.test(i.category || '') && M3_RE.test(i.unit || ''));
  const sums = new Map();
  for (const it of items) sums.set(it.ym, (sums.get(it.ym) || 0) + (+it.count || 0));
  const months = [...sums.keys()].sort();
  drawChart('#chart-concrete', {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{ label: 'm³', data: months.map(m => sums.get(m)), backgroundColor: '#43b581' }]
    },
    options: { plugins: { legend: { display: false } },
               scales: { y: { beginAtZero: true } } }
  });
}

// ─── 日報列表 ───
function renderTable() {
  const rows = filtered();
  const q = $('#search').value.trim().toLowerCase();
  const tbody = $('#reports-table tbody');
  const rs = rows.filter(r => {
    if (!q) return true;
    return JSON.stringify(r).toLowerCase().includes(q);
  }).slice(-200).reverse();
  tbody.innerHTML = rs.map(r => {
    const labor = (r.sections || []).flatMap(s => s.items || [])
      .filter(i => i.kind === 'labor' && i.count != null)
      .reduce((a,b) => a + (+b.count || 0), 0);
    const wd = r.date ? WD[(new Date(r.date).getDay()+6) % 7] : '';
    const summary = (r.sections || []).map(s =>
      `${s.area || ''}${(s.topic || '').slice(0, 18)}`).join(' · ');
    return `<tr>
      <td>${r.date || ''}</td>
      <td>${wd}</td>
      <td>${r.reporter || ''}</td>
      <td>${r.weather || ''}</td>
      <td>${(r.sections || []).length}</td>
      <td>${labor || ''}</td>
      <td class="summary">${summary}</td>
    </tr>`;
  }).join('');
}
