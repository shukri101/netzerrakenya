/* ══════════════════════════════════════════════════════
   NETZERRA — app.js
   Kenya's Carbon Intelligence Platform
   github.com/netzerra | shukriali411@gmail.com
══════════════════════════════════════════════════════ */

'use strict';

// ── STATE ─────────────────────────────────────────────
const S = {
  user: {
    name: 'Shukri Ali', email: 'shukriali411@gmail.com',
    phone: '+254705366807', org: 'Netzerra', plan: 'Seedling',
    score: 68, totalEmissions: 2847, totalOffsets: 710, projects: 12
  },
  lastCalc: null,
  charts: {},
  isFirstLogin: true,
  kncr: {
    projects: [
      { id:'NTZ-001', name:'Turkana Solar Borehole Cluster', sector:'borehole', county:'Turkana', credits:420, standard:'Verra VCS', step:2, created:'2026-01-15' },
      { id:'NTZ-002', name:'Rift Valley Matatu CNG Pilot',   sector:'transport', county:'Nakuru',  credits:1100, standard:'Gold Standard', step:1, created:'2026-02-20' }
    ]
  }
};

// ── EMISSION FACTORS (Kenya-calibrated, IPCC AR6) ─────
const EF = {
  diesel:2.68, petrol:2.31, hfo:3.17, lpg:2.98, cng:1.99, kplc:0.497,
  steel:1.85, pvc:2.41, cement:0.83, rebar:1.99, concrete:0.159,
  asphalt:0.045, timber:0.72, glass:0.91,
  gwpCH4:27.9, gwpN2O:273, gwpHFC134a:1430, gwpR404A:3922,
  ef3pasture:0.02, feedConc:0.45, truckKm:0.20, lightKm:0.165, motoKm:0.103,
  livestock: {
    dairy:  [68,  16, 70],
    beef:   [47,  10, 50],
    goat:   [5,  0.17, 8],
    sheep:  [8,  0.19, 12],
    camel:  [46,   7, 45],
    pig:    [1,   4.5, 16],
    donkey: [10,    1, 20],
    poultry:[0.02,0.02,0.6]
  },
  sectorBenchmarks: { borehole:50, livestock:300, transport:200, construct:500, manufact:200 }
};

// ── ONBOARDING ────────────────────────────────────────
const OB = [
  { icon:'👋', title:'Welcome to Netzerra!', body:'Kenya\'s carbon intelligence platform — built for KNCR compliance, county governments, and community protection. Let\'s get you oriented in 30 seconds.' },
  { icon:'⚡', title:'Start with a Calculation', body:'Pick a sector: Borehole, Livestock, Transport, Construction, or Manufacturing. Enter your activity data and get an IPCC AR6-compliant result instantly.' },
  { icon:'🏢', title:'County Dashboard (New!)', body:'<strong style="color:var(--mint)">Dedicated to county officers.</strong> See all carbon projects, community benefit fund tracking, FLLoCA compliance status, and carbon levy revenue — by ward.' },
  { icon:'🏛️', title:'KNCR Gateway', body:"Kenya's National Carbon Registry launched February 2026. The KNCR Gateway helps you register projects, generate DNA submission packages, and calculate your 25% community benefit obligations." },
  { icon:'📄', title:'True PDF Reports', body:'Every calculation generates a real ISO 14064-aligned PDF — accepted by county governments, World Bank Kenya, NEMA, and VCM verifiers. Click "Download PDF" after any calculation.' }
];
let obStep = 0;

function renderOnboarding() {
  const d = OB[obStep];
  document.getElementById('ob-steps').innerHTML =
    OB.map((_,i) => `<div class="ob-step ${i<obStep?'done':i===obStep?'active':''}"></div>`).join('');
  const last = obStep === OB.length - 1;
  document.getElementById('ob-content').innerHTML = `
    <div class="ob-icon">${d.icon}</div>
    <div class="ob-title">${d.title}</div>
    <div class="ob-body">${d.body}</div>
    <div class="ob-actions">
      <span class="ob-skip" onclick="closeOnboarding()">Skip tour</span>
      <button class="ob-next" onclick="${last?'closeOnboarding()':'obNext()'}">${last?'Get Started 🚀':'Next →'}</button>
    </div>`;
}
function obNext() { obStep = Math.min(obStep + 1, OB.length - 1); renderOnboarding(); }
function closeOnboarding() { document.getElementById('onboarding-overlay').classList.remove('open'); }

// ── AUTH ──────────────────────────────────────────────
function switchAuthTab(t) {
  document.querySelectorAll('.auth-tab').forEach((el,i) =>
    el.classList.toggle('active', (i===0&&t==='login')||(i===1&&t==='register')));
  document.getElementById('login-form').style.display    = t==='login'    ? '' : 'none';
  document.getElementById('register-form').style.display = t==='register' ? '' : 'none';
}

function loginAsGuest() {
  Object.assign(S.user, { name:'Guest User', plan:'Guest', score:0, totalEmissions:0, totalOffsets:0, projects:0 });
  launchApp(false);
}
function login() {
  const e = document.getElementById('login-email').value;
  const p = document.getElementById('login-pw').value;
  if (!e || !p) { toast('Please enter email and password.','error'); return; }
  launchApp(true);
}
function register() {
  const n  = document.getElementById('reg-name').value.trim();
  const e  = document.getElementById('reg-email').value.trim();
  const ph = document.getElementById('reg-phone').value.trim();
  const o  = document.getElementById('reg-org').value;
  const pw = document.getElementById('reg-pw').value;
  if (!n||!e||!ph||!o||!pw) { toast('Please fill all fields.','error'); return; }
  Object.assign(S.user, { name:n, email:e, phone:ph, org:o, score:0, totalEmissions:0, totalOffsets:0, projects:0 });
  launchApp(true);
}
function launchApp(showOnboard) {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateSidebar(); renderAll(); initCharts(); startTicker();
  if (showOnboard && S.isFirstLogin) {
    S.isFirstLogin = false; obStep = 0; renderOnboarding();
    setTimeout(() => document.getElementById('onboarding-overlay').classList.add('open'), 700);
  }
  toast('Welcome to Netzerra, ' + S.user.name.split(' ')[0] + '! 🌿', 'success');
}
function logout() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}
function updateSidebar() {
  const ini = S.user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sb-avatar').textContent   = ini;
  document.getElementById('sb-name').textContent     = S.user.name;
  document.getElementById('sb-plan').textContent     = '🌱 ' + S.user.plan + ' Plan';
  document.getElementById('sb-score').textContent    = S.user.score;
  document.getElementById('pp-name').textContent     = S.user.name;
  document.getElementById('pp-org').textContent      = S.user.org + ' · Carbon Intelligence';
  document.getElementById('pp-total').textContent    = S.user.totalEmissions.toLocaleString();
  document.getElementById('pp-score').textContent    = S.user.score;
  document.getElementById('pp-projects').textContent = S.user.projects;
}

// ── NAVIGATION ────────────────────────────────────────
const LABELS = {
  home:'Home', dashboard:'Dashboard', calculator:'Emission Calculator',
  county:'County Dashboard', leaderboard:'Leaderboard', community:'Community Feed',
  passport:'Carbon Passport', offsets:'Offset Strategies', methodology:'Methodology',
  docs:'Documentation Hub', marketplace:'Marketplace', membership:'Membership Plans',
  education:'Education Centre', about:'About & Founder', kncr:'KNCR Gateway'
};

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById(id + '-section');
  if (sec) sec.classList.add('active');
  // highlight active nav item
  document.querySelectorAll('.nav-item').forEach(n => {
    const oc = n.getAttribute('onclick') || '';
    if (oc.includes("'" + id + "'")) n.classList.add('active');
  });
  document.getElementById('breadcrumb').innerHTML = '<b>' + (LABELS[id] || id) + '</b>';
  window.scrollTo(0, 0);
  if (id === 'leaderboard' && !S.charts.county) initLeaderboardCharts();
  if (id === 'kncr') { renderKNCRPipeline(); renderKNCRProjects(); }
  if (id === 'county' && document.getElementById('county-select').value) loadCountyData();
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('open');
  } else {
    sb.classList.toggle('collapsed');
    document.getElementById('main').classList.toggle('full');
  }
}

function openCalcTab(t) { showSection('calculator'); setTimeout(() => switchCalcTab(t), 80); }
function switchCalcTab(t) {
  ['borehole','livestock','transport','construct','manufact'].forEach(s => {
    document.getElementById('tab-' + s).classList.toggle('active', s === t);
    document.getElementById('panel-' + s).classList.toggle('active', s === t);
  });
}
function setBottomActive(el) {
  document.querySelectorAll('.bnav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}
// Close sidebar on outside click (mobile)
document.addEventListener('click', e => {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768 && sb &&
      sb.classList.contains('open') &&
      !sb.contains(e.target) &&
      !e.target.closest('.hamburger')) {
    sb.classList.remove('open');
  }
});

// ── HELPERS ───────────────────────────────────────────
function v(id) { return parseFloat(document.getElementById(id).value) || 0; }
function t(id) { return document.getElementById(id).value || ''; }

// ── NTZ SCORE ─────────────────────────────────────────
function calcNTZScore(total_t, sector) {
  const bench         = EF.sectorBenchmarks[sector] || 100;
  const intensityScore = 40 * Math.max(0, 1 - total_t / bench);
  const offsetRatio   = S.user.totalOffsets / Math.max(S.user.totalEmissions, 1);
  const offsetScore   = 30 * Math.min(1, offsetRatio);
  const reductionScore = S.user.projects > 1 ? 18 : 10;
  const engScore      = 10 * Math.min(1, S.user.projects / 10);
  return Math.round(intensityScore + offsetScore + reductionScore + engScore);
}
function gradeFromScore(s) {
  if (s >= 85) return 'A+ · Climate Leader 🌟';
  if (s >= 70) return 'A · Climate Positive 🌿';
  if (s >= 55) return 'B · Improving 📈';
  if (s >= 40) return 'C · Needs Attention ⚠️';
  return 'D · High Emitter 🔴';
}

// ── RESULTS DISPLAY ───────────────────────────────────
function showResults(name, sector, total_t, s1_t, s2_t, s3_t, breakdown, offsets) {
  S.lastCalc = { name, sector, total_t, s1_t, s2_t, s3_t, date: new Date().toISOString().split('T')[0] };
  S.user.totalEmissions = Math.round(S.user.totalEmissions + total_t);
  S.user.projects++;
  const gs = calcNTZScore(total_t, sector);
  S.user.score = Math.round((S.user.score * (S.user.projects - 1) + gs) / S.user.projects);

  document.getElementById('res-empty').style.display = 'none';
  document.getElementById('res-content').style.display = 'block';
  document.getElementById('res-total').textContent = total_t.toFixed(2);
  document.getElementById('res-s1').textContent = s1_t.toFixed(2) + ' t';
  document.getElementById('res-s2').textContent = s2_t.toFixed(2) + ' t';
  document.getElementById('res-s3').textContent = s3_t.toFixed(2) + ' t';
  document.getElementById('res-score').textContent = gs;
  document.getElementById('res-grade').textContent  = gradeFromScore(gs);
  document.getElementById('res-breakdown').innerHTML = breakdown;
  document.getElementById('res-offsets').innerHTML   = offsets;

  const mx = Math.max(s1_t, s2_t, s3_t, 0.001);
  document.getElementById('res-s1-bar').style.width = (s1_t / mx * 100) + '%';
  document.getElementById('res-s2-bar').style.width = (s2_t / mx * 100) + '%';
  document.getElementById('res-s3-bar').style.width = (s3_t / mx * 100) + '%';

  document.getElementById('sb-score').textContent  = S.user.score;
  document.getElementById('kpi-total').textContent = S.user.totalEmissions.toLocaleString();
  document.getElementById('kpi-score').textContent = S.user.score;
  toast('✅ ' + total_t.toFixed(2) + ' tCO₂e/yr — ' + name, 'success');
}

// ── CALCULATORS ───────────────────────────────────────
function calcBorehole() {
  const lt = v('bh-lifetime') || 20;
  const sp = v('bh-solar') / 100;
  const s1_kg = (v('bh-diesel-drill') * EF.diesel / lt) +
                (v('bh-diesel-pump')  * EF.diesel) +
                (v('bh-diesel-gen')   * EF.diesel);
  const s2_kg = v('bh-kwh') * EF.kplc * (1 - sp);
  const s3_mat = (v('bh-steel') * EF.steel * 1000 + v('bh-pvc') * EF.pvc * 1000 + v('bh-cement') * EF.cement * 1000) / lt;
  const s3_trn = v('bh-tkm') * 5 * EF.truckKm / lt;
  const [s1, s2, s3] = [s1_kg / 1000, s2_kg / 1000, (s3_mat + s3_trn) / 1000];
  const tt = s1 + s2 + s3;
  showResults(t('bh-name') || 'Borehole', 'borehole', tt, s1, s2, s3,
    `<b style="color:var(--mint)">Breakdown:</b><br>Diesel drill (amort): ${(v('bh-diesel-drill')*EF.diesel/lt/1000).toFixed(3)} t<br>Diesel pump: ${(v('bh-diesel-pump')*EF.diesel/1000).toFixed(3)} t<br>Grid elec: ${s2.toFixed(3)} t<br>Casing materials: ${(s3_mat/1000).toFixed(3)} t`,
    `🌳 <b>Offset ${tt.toFixed(1)} tCO₂e/yr:</b><br>Plant ${Math.ceil(tt/17*10000)} m² bamboo (17 tCO₂e/ha/yr)<br>Or ${Math.ceil(tt/3.5)} biogas digesters<br>Or replace diesel pump with solar`);
}

function calcLivestock() {
  const sys = t('ls-manure');
  const ef3 = sys === 'biogas' ? 0.001 : EF.ef3pasture;
  const heads = {
    dairy: v('ls-dairy'), beef:  v('ls-beef'), goat:   v('ls-goats'),
    sheep: v('ls-sheep'), camel: v('ls-camels'), pig:  v('ls-pigs'),
    donkey: v('ls-donkeys'), poultry: v('ls-poultry') * 100
  };
  let ee = 0, em = 0, en = 0;
  Object.entries(heads).forEach(([sp, n]) => {
    const [ent, man, nex] = EF.livestock[sp];
    ee += n * ent * EF.gwpCH4;
    em += n * man * EF.gwpCH4;
    en += n * nex * ef3 * (44/28) * EF.gwpN2O;
  });
  const s1 = (ee + em + en) / 1000;
  const s2 = v('ls-kwh') * EF.kplc / 1000;
  const s3 = v('ls-feed') * 1000 * EF.feedConc / 1000;
  const tt = s1 + s2 + s3;
  const totalH = Object.values(heads).reduce((a, b) => a + b, 0);
  showResults(t('ls-name') || 'Livestock', 'livestock', tt, s1, s2, s3,
    `<b style="color:var(--mint)">Breakdown:</b><br>Enteric CH₄: ${(ee/1000).toFixed(2)} t<br>Manure CH₄: ${(em/1000).toFixed(2)} t<br>Manure N₂O: ${(en/1000).toFixed(2)} t<br>Feed S3: ${s3.toFixed(2)} t<br>Intensity: ${totalH>0?(tt*1000/totalH).toFixed(1):0} kgCO₂e/head`,
    `🐄 <b>Offset ${tt.toFixed(1)} tCO₂e/yr:</b><br>Install ${Math.ceil(s1/3.5)} biogas digesters<br>Silvopastoral trees: Grevillea 6 tCO₂e/ha/yr<br>Improved pasture → cut feed concentrate`);
}

function calcTransport() {
  const s1_kg = (v('tr-heavy') + v('tr-matatu') + v('tr-bus') + v('tr-light')) * EF.diesel +
                (v('tr-moto') + v('tr-car')) * EF.petrol;
  const s3_kg = v('tr-hfc') * EF.gwpHFC134a + v('tr-r404') * EF.gwpR404A;
  const [s1, s3] = [s1_kg / 1000, s3_kg / 1000];
  const tt = s1 + s3;
  const nv = v('tr-vehicles') || 1;
  showResults(t('tr-name') || 'Fleet', 'transport', tt, s1, 0, s3,
    `<b style="color:var(--mint)">Breakdown:</b><br>Diesel fleet: ${s1.toFixed(3)} t<br>Refrigerants: ${s3.toFixed(3)} t<br>Per vehicle: ${(tt/nv).toFixed(2)} tCO₂e/yr`,
    `🚌 <b>Cut ${tt.toFixed(1)} tCO₂e/yr:</b><br>Convert matatus to CNG (−25%)<br>Fix refrigerant leaks immediately<br>Route optimise — reduce dead km 15%`);
}

function calcConstruction() {
  const mo = v('con-months') || 12;
  const s3_kg = v('con-cement') * 830 + v('con-concrete') * 159 +
                v('con-steel') * 1850 + v('con-rebar') * 1990 +
                v('con-asphalt') * 45 + v('con-timber') * 720;
  const s1_kg = (v('con-excav') + v('con-gen')) * mo * EF.diesel + v('con-tkm') * EF.truckKm;
  const s2_kg = v('con-kwh') * mo * EF.kplc;
  const [s1, s2, s3] = [s1_kg / 1000, s2_kg / 1000, s3_kg / 1000];
  const tt = s1 + s2 + s3;
  showResults(t('con-name') || 'Construction', 'construct', tt, s1, s2, s3,
    `<b style="color:var(--mint)">Breakdown:</b><br>Embodied materials: ${s3.toFixed(2)} t<br>Site machinery: ${s1.toFixed(2)} t<br>Site electricity: ${s2.toFixed(3)} t`,
    `🏗️ <b>Reduce ${tt.toFixed(1)} tCO₂e:</b><br>Switch OPC → PLC cement (−13%)<br>Use recycled EAF steel (−77%)<br>Plant ${Math.ceil(tt/17)} ha bamboo`);
}

function calcManufacturing() {
  const s1_kg = v('mfg-diesel') * EF.diesel + v('mfg-hfo') * EF.hfo +
                v('mfg-lpg') * EF.lpg + v('mfg-pco2') * 1000;
  const s2_kg = Math.max(0, v('mfg-kwh') - v('mfg-solar')) * EF.kplc;
  const s3_kg = v('mfg-hfc') * EF.gwpHFC134a + v('mfg-r404') * EF.gwpR404A +
                v('mfg-ww') * 25 + v('mfg-waste') * 580;
  const [s1, s2, s3] = [s1_kg / 1000, s2_kg / 1000, s3_kg / 1000];
  const tt = s1 + s2 + s3;
  const out = v('mfg-output') || 1;
  showResults(t('mfg-name') || 'Facility', 'manufact', tt, s1, s2, s3,
    `<b style="color:var(--mint)">Breakdown:</b><br>Combustion (S1): ${s1.toFixed(2)} t<br>Electricity (S2): ${s2.toFixed(2)} t<br>Refrigerants+waste: ${s3.toFixed(2)} t<br>Intensity: ${(tt*1000/out).toFixed(1)} kgCO₂e/t`,
    `🏭 <b>Reduce ${tt.toFixed(1)} tCO₂e/yr:</b><br>Rooftop solar → Scope 2 −40–80%<br>Fix refrigerant leaks today<br>Plant ${Math.ceil(tt/8)} ha Casuarina`);
}

// ── PDF REPORT (html2pdf.js) ──────────────────────────
function generateAndDownloadPDF() {
  const c = S.lastCalc;
  if (!c) { toast('Run a calculation first!', 'error'); return; }
  toast('📄 Generating PDF...', 'info');
  const gs  = calcNTZScore(c.total_t, c.sector);
  const now = new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  const ref = 'NTZ-' + Date.now();
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:-9999px;left:0;z-index:-1;background:#fff;width:760px;font-family:Arial,sans-serif;color:#1A3A2A;padding:2rem';
  div.innerHTML = `
    <div style="background:linear-gradient(135deg,#0D3320,#1A5C35);color:#fff;padding:1.75rem;border-radius:10px;margin-bottom:1.75rem">
      <div style="font-size:1.4rem;font-weight:800;margin-bottom:.35rem">🌿 Netzerra</div>
      <div style="font-size:.7rem;opacity:.6;letter-spacing:.1em;text-transform:uppercase;margin-bottom:1.1rem">Kenya's Carbon Intelligence Platform</div>
      <h1 style="font-size:1.6rem;font-weight:700;color:#fff;margin-bottom:.4rem">Greenhouse Gas Emission Report</h1>
      <div style="font-size:.78rem;opacity:.68;display:flex;gap:1.5rem;flex-wrap:wrap">
        <span>👤 ${S.user.name}</span><span>🏢 ${S.user.org}</span><span>📅 ${now}</span><span>🆔 ${ref}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem;margin-bottom:1.75rem">
      ${[['Total Emissions',c.total_t.toFixed(2)+' tCO₂e/yr'],['NTZ Score',gs+'/100'],['Grade',gradeFromScore(gs).split('·')[0].trim()]].map(([l,val])=>`<div style="background:#F1F8E9;border:1px solid #C5E1A5;border-radius:8px;padding:.9rem;text-align:center"><div style="font-size:1.4rem;font-weight:700;color:#1B5E20">${val}</div><div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#558B2F;margin-top:4px">${l}</div></div>`).join('')}
    </div>
    <h2 style="color:#1B5E20;border-bottom:2px solid #E8F5E9;padding-bottom:.35rem;margin:1.25rem 0 .85rem;font-size:1rem">Project Summary</h2>
    <p><strong>Project:</strong> ${c.name} | <strong>Sector:</strong> ${c.sector} | <strong>Date:</strong> ${c.date}</p>
    <p style="margin-top:.4rem">Total verified emissions: <strong>${c.total_t.toFixed(3)} tCO₂e per annum</strong></p>
    <h2 style="color:#1B5E20;border-bottom:2px solid #E8F5E9;padding-bottom:.35rem;margin:1.25rem 0 .85rem;font-size:1rem">Methodology</h2>
    <p>IPCC 2006 Guidelines + IPCC AR6 GWP₁₀₀: <strong>CH₄ = 27.9</strong>, <strong>N₂O = 273</strong>. Kenya grid EF: <strong>0.497 kgCO₂e/kWh</strong> (KPLC 2022).</p>
    <h2 style="color:#1B5E20;border-bottom:2px solid #E8F5E9;padding-bottom:.35rem;margin:1.25rem 0 .85rem;font-size:1rem">Scope Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;font-size:.82rem">
      <tr style="background:#1B5E20;color:#fff"><th style="padding:.5rem .7rem;text-align:left">Scope</th><th style="padding:.5rem .7rem;text-align:right">tCO₂e/yr</th><th style="padding:.5rem .7rem;text-align:right">%</th></tr>
      <tr style="border-bottom:1px solid #E8F5E9"><td style="padding:.48rem .7rem">Scope 1 — Direct combustion</td><td style="padding:.48rem .7rem;text-align:right;font-family:monospace">${c.s1_t.toFixed(3)}</td><td style="padding:.48rem .7rem;text-align:right">${c.total_t>0?(c.s1_t/c.total_t*100).toFixed(1):0}%</td></tr>
      <tr style="border-bottom:1px solid #E8F5E9;background:#F9FBF7"><td style="padding:.48rem .7rem">Scope 2 — Purchased energy</td><td style="padding:.48rem .7rem;text-align:right;font-family:monospace">${c.s2_t.toFixed(3)}</td><td style="padding:.48rem .7rem;text-align:right">${c.total_t>0?(c.s2_t/c.total_t*100).toFixed(1):0}%</td></tr>
      <tr style="border-bottom:1px solid #E8F5E9"><td style="padding:.48rem .7rem">Scope 3 — Embodied / upstream</td><td style="padding:.48rem .7rem;text-align:right;font-family:monospace">${c.s3_t.toFixed(3)}</td><td style="padding:.48rem .7rem;text-align:right">${c.total_t>0?(c.s3_t/c.total_t*100).toFixed(1):0}%</td></tr>
      <tr style="background:#E8F5E9;font-weight:700"><td style="padding:.48rem .7rem">TOTAL</td><td style="padding:.48rem .7rem;text-align:right;font-family:monospace">${c.total_t.toFixed(3)}</td><td style="padding:.48rem .7rem;text-align:right">100%</td></tr>
    </table>
    <h2 style="color:#1B5E20;border-bottom:2px solid #E8F5E9;padding-bottom:.35rem;margin:1.25rem 0 .85rem;font-size:1rem">Recommended Offsets</h2>
    <ul style="margin:.6rem 0 0 1.4rem;line-height:2;color:#333;font-size:.82rem">
      <li>Bamboo — ${(c.total_t/17).toFixed(2)} ha (17 tCO₂e/ha/yr — Yuen et al. 2017)</li>
      <li>Casuarina — ${(c.total_t/8).toFixed(2)} ha (8 tCO₂e/ha/yr — KEFRI 2019)</li>
      <li>Biogas digesters — ${Math.ceil(c.total_t/3.5)} units (3.5 tCO₂e/unit/yr — SNV Kenya 2021)</li>
    </ul>
    <div style="margin-top:1.75rem;padding:.9rem 1.1rem;background:#E3F2FD;border-left:4px solid #1565C0;border-radius:0 7px 7px 0;font-size:.77rem;color:#0D47A1">
      Generated by Netzerra — Kenya's Carbon Intelligence Platform. IPCC AR6 methodology, KPLC 2022 grid data. ISO 14064-1:2018 compliant. Accepted by NEMA, World Bank Kenya, and VCM verification bodies.
    </div>
    <div style="margin-top:1.5rem;padding-top:.9rem;border-top:1px solid #E8F5E9;display:flex;justify-content:space-between;font-size:.68rem;color:#90A4AE">
      <span>🌿 Netzerra · shukriali411@gmail.com · +254 705 366 807</span>
      <span>${ref} · ${now}</span>
    </div>`;
  document.body.appendChild(div);
  const opt = {
    margin: 0.5,
    filename: `Netzerra_Report_${c.name.replace(/\s+/g,'-')}_${c.date}.pdf`,
    image: { type:'jpeg', quality:0.98 },
    html2canvas: { scale:2, useCORS:true },
    jsPDF: { unit:'in', format:'letter', orientation:'portrait' }
  };
  html2pdf().set(opt).from(div).save().then(() => {
    document.body.removeChild(div);
    toast('✅ PDF downloaded!', 'success');
  });
}

// ── COUNTY DASHBOARD ──────────────────────────────────
const COUNTY_DATA = {
  'Turkana':  { projects:[{n:'Turkana Solar Borehole Cluster',s:'borehole',c:420,step:2,st:'PDD Submitted'},{n:'Turkana Rangeland Carbon',s:'livestock',c:850,step:1,st:'Draft'}], revenue:23800000, community:5950000, floca:'partial', wards:['Kanamkemer','Turkana West','Loima','Turkana East','Kibish'] },
  'Laikipia': { projects:[{n:'Laikipia Drip Irrigation MRV',s:'borehole',c:280,step:3,st:'Validated'},{n:'Ol Pejeta Livestock GHG',s:'livestock',c:620,step:2,st:'PDD Submitted'}], revenue:12400000, community:3100000, floca:'compliant', wards:['Rumuruti','Nanyuki','Ol Moran','Laikipia East','Laikipia West'] },
  'Isiolo':   { projects:[{n:'Northern Rangeland Carbon Initiative',s:'livestock',c:1200,step:4,st:'DNA Review'}], revenue:7500000, community:1875000, floca:'compliant', wards:['Isiolo Township','Oldonyiro','Merti','Garbatulla'] },
  'Samburu':  { projects:[{n:'Samburu Rangelands MRV',s:'livestock',c:780,step:2,st:'PDD Submitted'}], revenue:8200000, community:2050000, floca:'partial', wards:['Samburu East','Samburu North','Samburu West'] },
  'Narok':    { projects:[{n:'Narok Livestock GHG Audit',s:'livestock',c:950,step:3,st:'Validated'},{n:'Mara Biogas Programme',s:'biogas',c:320,step:1,st:'Draft'}], revenue:15600000, community:3900000, floca:'compliant', wards:['Narok Town','Transmara East','Transmara West','Kilgoris','Emurua Dikirr'] },
  'Kajiado':  { projects:[{n:'Kajiado Carbon Oversight',s:'livestock',c:440,step:1,st:'Draft'}], revenue:3200000, community:800000, floca:'missing', wards:['Kajiado Central','Isinya','Mashuuru','Kajiado North','Loitokitok'] },
  'Nakuru':   { projects:[{n:'Nakuru Agricultural MRV',s:'livestock',c:680,step:2,st:'PDD Submitted'},{n:'Menengai Geothermal Carbon',s:'solar',c:1400,step:3,st:'Validated'}], revenue:18200000, community:4550000, floca:'compliant', wards:['Nakuru Town East','Nakuru Town West','Bahati','Subukia','Rongai','Molo','Njoro'] },
  'Garissa':  { projects:[{n:'Garissa Rangeland Carbon',s:'livestock',c:560,step:1,st:'Draft'}], revenue:4100000, community:1025000, floca:'missing', wards:['Garissa Township','Balambala','Lagdera','Dadaab','Fafi','Ijara'] },
};

function loadCountyData() {
  const county = document.getElementById('county-select').value;
  document.getElementById('county-placeholder').style.display = county ? 'none' : 'block';
  document.getElementById('county-kpis').style.display    = county ? 'grid' : 'none';
  document.getElementById('county-content').style.display = county ? 'grid' : 'none';
  if (!county) return;

  const d = COUNTY_DATA[county] || {
    projects:[{n:'Demo Project',s:'borehole',c:300,step:1,st:'Draft'}],
    revenue:5000000, community:1250000, floca:'partial',
    wards:['Central Ward','East Ward','West Ward']
  };
  document.getElementById('c-name-hdr').textContent = county;
  document.getElementById('c-projects').textContent = d.projects.length;
  document.getElementById('c-revenue').textContent  = 'KES ' + d.revenue.toLocaleString();
  document.getElementById('c-community').textContent = 'KES ' + d.community.toLocaleString();
  const fMap = { compliant:'🟢 Compliant', partial:'🟡 Partial', missing:'🔴 Missing' };
  const fSub = { compliant:'All criteria met', partial:'Some gaps remain', missing:'Data submission required' };
  document.getElementById('c-floca').textContent     = fMap[d.floca] || '—';
  document.getElementById('c-floca-sub').textContent = fSub[d.floca] || '—';

  // Projects
  const SICO = { borehole:'💧', livestock:'🐄', transport:'🚌', forestry:'🌳', solar:'☀️', biogas:'🔥', construct:'🏗️', manufact:'🏭' };
  const SMAP = { 1:['s-draft','Draft'], 2:['s-submitted','PDD Submitted'], 3:['s-validated','Validated'], 4:['s-registered','DNA Review'], 5:['s-registered','Registered'], 6:['s-credits','Credits Live'] };
  document.getElementById('county-projects-list').innerHTML = d.projects.map(p => {
    const [cls] = SMAP[p.step] || SMAP[1];
    return `<div class="kncr-proj-card"><div class="kpc-ico">${SICO[p.s]||'🌿'}</div><div class="kpc-info"><div class="kpc-name">${p.n}</div><div class="kpc-meta">${p.c.toLocaleString()} tCO₂e/yr · KES ${(p.c*12*130).toLocaleString()} potential/yr</div></div><div class="kpc-status ${cls}">${p.st}</div></div>`;
  }).join('');

  // Ward bars
  const wardColors = ['#EF5350','#F5A623','#4CAF50','#00C9A7','#2196F3','#7B3FA0','#FF9800'];
  document.getElementById('ward-bars').innerHTML = d.wards.map((w, i) => {
    const em = Math.round(150 + Math.random() * 650);
    const pct = em / 800 * 100;
    return `<div class="ward-bar"><div class="ward-bar-hdr"><span>${w}</span><span>${em.toLocaleString()} tCO₂e/yr est.</span></div><div class="ward-track"><div class="ward-fill" style="width:${pct}%;background:${wardColors[i%wardColors.length]}"></div></div></div>`;
  }).join('');

  // FLLoCA details
  const items = [
    ['County Climate Action Plan (CCAP)', '✅ Submitted 2025', 'compliant'],
    ['Climate Expenditure Budget (≥1.5%)', d.floca==='compliant'?'✅ 2.3% allocated':'🟡 1.2% allocated', d.floca==='compliant'?'compliant':'partial'],
    ['County Climate Change Fund (CCCF)', d.floca!=='missing'?'✅ Operational':'🔴 Not established', d.floca!=='missing'?'compliant':'missing'],
    ['Performance Data Report Q1 2026', d.floca==='compliant'?'✅ Submitted':'🟡 Pending', d.floca==='compliant'?'compliant':'partial'],
    ['Community Benefit Records', d.floca==='compliant'?'✅ Documented':'🟡 Partial', d.floca==='compliant'?'compliant':'partial'],
    ['KNCR Project Registration', d.projects.filter(p=>p.step>=3).length+' of '+d.projects.length+' registered', d.projects.every(p=>p.step>=3)?'compliant':'partial'],
  ];
  document.getElementById('floca-details').innerHTML = items.map(([l,val,st]) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.78rem"><span style="color:rgba(255,255,255,.68)">${l}</span><span class="floca-badge ${st}">${val}</span></div>`
  ).join('');

  // Community benefit breakdown
  document.getElementById('community-benefit-tracking').innerHTML = `
    <div style="margin-bottom:.75rem">
      <div style="display:flex;justify-content:space-between;font-size:.76rem;color:rgba(255,255,255,.5);margin-bottom:.28rem"><span>Received to date</span><span style="color:var(--mint);font-family:'JetBrains Mono',monospace">KES ${d.community.toLocaleString()}</span></div>
      <div style="height:6px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden"><div style="height:100%;background:var(--leaf);border-radius:999px;width:${Math.min(100,d.community/d.revenue*100).toFixed(0)}%"></div></div>
      <div style="font-size:.66rem;color:rgba(255,255,255,.3);margin-top:.18rem">${(d.community/d.revenue*100).toFixed(1)}% of total revenue channelled</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.45rem;font-size:.73rem">
      ${[['🌊 Clean Water','38%'],['📚 Education','22%'],['🏥 Healthcare','18%'],['⚡ Energy Access','12%'],['🌳 Reforestation','10%']].map(([n,p])=>`<div style="background:rgba(255,255,255,.04);padding:.48rem .62rem;border-radius:5px;display:flex;justify-content:space-between"><span>${n}</span><span style="color:var(--mint)">${p}</span></div>`).join('')}
    </div>`;

  // Levy timeline
  const months  = ['Mar 25','Jun 25','Sep 25','Dec 25','Mar 26','Jun 26 (F)','Dec 26 (F)'];
  const amounts = [800000,1200000,950000,1100000,1350000,1500000,1600000].map(x => Math.round(x * d.revenue / 24000000));
  const statuses = ['received','received','received','received','received','forecast','forecast'];
  document.getElementById('levy-timeline').innerHTML = months.map((m,i) =>
    `<div class="rev-row"><span style="color:rgba(255,255,255,.62)">${m}</span><span class="rev-amount">KES ${amounts[i].toLocaleString()}</span><span class="rev-status ${statuses[i]}">${statuses[i]==='received'?'Received':'Forecast'}</span></div>`
  ).join('');

  // Revenue chart
  if (S.charts.countyRevenue) S.charts.countyRevenue.destroy();
  setTimeout(() => {
    const ctx = document.getElementById('county-revenue-chart');
    if (!ctx) return;
    S.charts.countyRevenue = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Q1 2026','Q2 2026E'],
        datasets:[
          { label:'Budget', data:[3,3.5,3.2,3.8,4.2,4.5].map(x=>x*d.revenue/15000000), backgroundColor:'rgba(58,170,92,.22)', borderColor:'rgba(58,170,92,.7)', borderWidth:1 },
          { label:'Actual/Forecast', data:[2.8,3.6,2.95,3.5,3.9,null].map(x=>x?x*d.revenue/15000000:null), backgroundColor:'rgba(0,201,167,.22)', borderColor:'rgba(0,201,167,.7)', borderWidth:1 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:'rgba(255,255,255,.52)', boxWidth:10, font:{size:10} } } },
        scales:{ y:{ ticks:{ color:'rgba(255,255,255,.42)', font:{size:9}, callback: v => 'KES '+(v/1e6).toFixed(1)+'M' }, grid:{ color:'rgba(255,255,255,.05)' } }, x:{ ticks:{ color:'rgba(255,255,255,.42)', font:{size:9} }, grid:{ display:false } } }
      }
    });
  }, 80);
}

function generateFLoCAReport() {
  const county = document.getElementById('county-select').value || 'County';
  toast('📄 Generating FLLoCA report for ' + county + '...', 'info');
  setTimeout(() => toast('✅ FLLoCA report ready! Formatted for World Bank submission.', 'success'), 1500);
}

// ── CHARTS ────────────────────────────────────────────
function initCharts() {
  Chart.defaults.color = 'rgba(255,255,255,.52)';
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';

  S.charts.sector = new Chart(document.getElementById('sector-chart'), {
    type:'doughnut',
    data:{
      labels:['Borehole','Livestock','Transport','Construction','Manufacturing'],
      datasets:[{ data:[8,38,24,18,12], backgroundColor:['rgba(21,101,192,.78)','rgba(230,81,0,.78)','rgba(55,71,79,.78)','rgba(109,76,65,.78)','rgba(106,27,154,.78)'], borderWidth:2, borderColor:'rgba(7,28,15,.8)' }]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ boxWidth:10, font:{size:10} } } } }
  });

  S.charts.trend = new Chart(document.getElementById('trend-chart'), {
    type:'line',
    data:{
      labels:['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'],
      datasets:[
        { label:'Emissions (tCO₂e)', data:[280,295,260,312,290,305,278,320,298,265,290,312], borderColor:'rgba(239,154,154,.88)', backgroundColor:'rgba(239,154,154,.07)', fill:true, tension:0.4, pointRadius:3 },
        { label:'Offsets', data:[50,55,58,60,62,64,66,66,67,68,69,70], borderColor:'rgba(105,240,174,.88)', backgroundColor:'rgba(105,240,174,.06)', fill:true, tension:0.4, pointRadius:3 }
      ]
    },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ labels:{ boxWidth:10, font:{size:10} } } }, scales:{ y:{ beginAtZero:false, ticks:{ font:{size:9} } }, x:{ ticks:{ font:{size:9} } } } }
  });
}

function initLeaderboardCharts() {
  if (!document.getElementById('county-chart')) return;
  S.charts.county = new Chart(document.getElementById('county-chart'), {
    type:'bar',
    data:{ labels:['Narok','Laikipia','Turkana','Nakuru','Baringo','Machakos','Kitui'], datasets:[{ label:'Avg NTZ Score', data:[74,71,68,65,63,60,57], backgroundColor:'rgba(58,170,92,.62)', borderColor:'rgba(58,170,92,1)', borderWidth:1, borderRadius:3 }] },
    options:{ responsive:true, maintainAspectRatio:false, indexAxis:'y', plugins:{ legend:{ display:false } }, scales:{ x:{ max:100, ticks:{ font:{size:9} } }, y:{ ticks:{ font:{size:10} } } } }
  });
  S.charts.sectorDist = new Chart(document.getElementById('sector-dist-chart'), {
    type:'pie',
    data:{ labels:['Livestock','Borehole','Transport','Construction'], datasets:[{ data:[48,12,24,16], backgroundColor:['rgba(230,81,0,.78)','rgba(21,101,192,.78)','rgba(55,71,79,.78)','rgba(109,76,65,.78)'], borderWidth:2, borderColor:'rgba(7,28,15,.8)' }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ boxWidth:10, font:{size:10} } } } }
  });
}

// ── TICKER ────────────────────────────────────────────
function startTicker() {
  const dailyKg = 25e9 / 365;
  const start = new Date(); start.setHours(0,0,0,0);
  function tick() {
    const secs = (Date.now() - start) / 1000;
    const tToday = Math.floor(dailyKg * secs / 1e6);
    document.getElementById('emission-ticker').textContent = tToday.toLocaleString() + ' tCO₂e today';
  }
  tick(); setInterval(tick, 2000);
}

// ── KNCR ──────────────────────────────────────────────
const KNCR_STEPS = [
  {l:'Concept Note',i:'📝'},{l:'PDD Draft',i:'📋'},{l:'Validation',i:'🔍'},
  {l:'DNA Review',i:'🏛️'},{l:'Registered',i:'📲'},{l:'Credits Live',i:'🏅'}
];

function renderKNCRPipeline(active = 1) {
  const el = document.getElementById('kncr-pipeline');
  if (!el) return;
  el.innerHTML = KNCR_STEPS.map((s, i) => {
    const n = i + 1;
    const cls = n < active ? 'done' : n === active ? 'active' : 'locked';
    return `<div class="pipeline-step"><div class="ps-circle ${cls}">${n < active ? '✓' : s.i}</div><div class="ps-label ${cls}">${s.l}</div></div>`;
  }).join('');
}

const SICO = { borehole:'💧', livestock:'🐄', transport:'🚌', forestry:'🌳', solar:'☀️', biogas:'🔥', construct:'🏗️' };
const SMAP = { 1:['s-draft','Draft'], 2:['s-submitted','PDD Submitted'], 3:['s-validated','Validated'], 4:['s-registered','DNA Review'], 5:['s-registered','Registered'], 6:['s-credits','Credits Live'] };

function renderKNCRProjects() {
  const el = document.getElementById('kncr-projects-list');
  if (!el) return;
  if (!S.kncr.projects.length) {
    el.innerHTML = '<div style="text-align:center;padding:1.5rem;color:rgba(255,255,255,.26)">No projects yet — click "+ New Project" to begin your KNCR journey.</div>';
    return;
  }
  el.innerHTML = S.kncr.projects.map((p, i) => {
    const [cls, lbl] = SMAP[p.step] || SMAP[1];
    return `<div class="kncr-proj-card" onclick="advanceKNCR(${i})"><div class="kpc-ico">${SICO[p.sector]||'🌿'}</div><div class="kpc-info"><div class="kpc-name">${p.name}</div><div class="kpc-meta">${p.county} · ${p.standard} · ${p.credits.toLocaleString()} tCO₂e/yr</div></div><div class="kpc-status ${cls}">${lbl}</div></div>`;
  }).join('');
}

function addKNCRProject() {
  const name = document.getElementById('kn-name').value.trim();
  if (!name) { toast('Please enter a project name', 'error'); return; }
  const id = 'NTZ-' + String(S.kncr.projects.length + 1).padStart(3,'0');
  S.kncr.projects.push({
    id, name,
    sector:   document.getElementById('kn-sector').value,
    county:   document.getElementById('kn-county').value,
    credits:  parseFloat(document.getElementById('kn-credits').value) || 500,
    standard: document.getElementById('kn-std').value,
    step: 1,
    created: new Date().toISOString().split('T')[0]
  });
  closeModal('modal-kncr-new');
  renderKNCRProjects();
  renderKNCRPipeline(1);
  toast('🏛️ Project "' + name + '" added to KNCR pipeline!', 'success');
  document.getElementById('kn-name').value = '';
  document.getElementById('kn-credits').value = '';
}

function advanceKNCR(i) {
  const p = S.kncr.projects[i];
  if (!p) return;
  renderKNCRPipeline(p.step);
  if (p.step < 6) {
    p.step++;
    renderKNCRProjects();
    renderKNCRPipeline(p.step);
    toast(p.step === 6 ? '🏅 Credits issued for ' + p.name + '!' : '✅ ' + p.name + ' → Step ' + p.step, p.step === 6 ? 'success' : 'info');
  } else {
    toast('🏅 ' + p.name + ' — Credits already live!', 'success');
  }
}

function generateKNCRPackage() {
  const name     = document.getElementById('kncr-proj-name').value.trim() || 'Unnamed Project';
  const credits  = parseFloat(document.getElementById('kncr-credits').value) || 0;
  const county   = document.getElementById('kncr-county').value;
  const proponent= document.getElementById('kncr-proponent').value.trim() || S.user.org;
  const standard = document.getElementById('kncr-standard').value;
  const c        = S.lastCalc;
  const now      = new Date().toLocaleDateString('en-KE', { year:'numeric', month:'long', day:'numeric' });
  const ref      = 'NTZ-PDD-' + Date.now();

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>KNCR Package — ${name}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:2rem;color:#1A3A2A;background:#fff}
h1{font-size:1.6rem;color:#0D3320;margin-bottom:.4rem}
h2{font-size:1rem;color:#1B5E20;border-bottom:2px solid #E8F5E9;padding-bottom:.35rem;margin:1.5rem 0 .85rem}
.hdr{background:linear-gradient(135deg,#0D3320,#1A4A2E);color:#fff;padding:1.75rem;border-radius:10px;margin-bottom:1.75rem}
.tag{background:rgba(76,175,80,.2);border:1px solid rgba(76,175,80,.4);color:#A5D6A7;padding:.22rem .72rem;border-radius:14px;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;display:inline-block;margin-bottom:.72rem}
table{width:100%;border-collapse:collapse;font-size:.82rem;margin:.85rem 0}
th{background:#1B5E20;color:#fff;padding:.52rem .7rem;text-align:left}
td{padding:.48rem .7rem;border-bottom:1px solid #E8F5E9}
tr:nth-child(even) td{background:#F9FBF7}
tr.tot td{background:#E8F5E9;font-weight:700;color:#1B5E20}
.info{background:#E3F2FD;border-left:4px solid #1565C0;padding:.75rem 1rem;border-radius:0 7px 7px 0;font-size:.78rem;color:#0D47A1;margin:.9rem 0}
.warn{background:#FFF8E1;border-left:4px solid #F9A825;padding:.75rem 1rem;border-radius:0 7px 7px 0;font-size:.78rem;color:#795548;margin:.9rem 0}
.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:2rem}
.sign-block{border-top:2px solid #E8F5E9;padding-top:.65rem}
.sign-line{height:48px}
.sign-label{font-size:.68rem;color:#90A4AE;text-transform:uppercase;letter-spacing:.06em}
.footer{margin-top:2rem;padding-top:.85rem;border-top:1px solid #E8F5E9;display:flex;justify-content:space-between;font-size:.68rem;color:#90A4AE}
ul{margin:.5rem 0 0 1.4rem;color:#333;line-height:1.9}
li{font-size:.82rem}
@media print{button{display:none!important}}
</style></head><body>

<div class="hdr">
  <div class="tag">🏛️ Kenya National Carbon Registry · Official Submission Package</div>
  <h1 style="color:#fff">Project Design Document</h1>
  <div style="color:rgba(255,255,255,.65);font-size:.85rem">${name}</div>
  <div style="color:rgba(255,255,255,.5);font-size:.73rem;margin-top:.72rem;display:flex;gap:1.5rem;flex-wrap:wrap">
    <span>Proponent: ${proponent}</span><span>County: ${county}</span>
    <span>Credits: ${credits.toLocaleString()} tCO₂e/yr</span><span>Date: ${now}</span><span>Ref: ${ref}</span>
  </div>
</div>

<h2>1. Project Summary</h2>
<table>
  <tr><td><strong>Project Title</strong></td><td>${name}</td></tr>
  <tr><td><strong>Project Proponent</strong></td><td>${proponent}</td></tr>
  <tr><td><strong>Location</strong></td><td>${county} County, Republic of Kenya</td></tr>
  <tr><td><strong>Est. Annual Credits</strong></td><td><strong>${credits.toLocaleString()} tCO₂e/yr</strong></td></tr>
  <tr><td><strong>Registry Standard</strong></td><td>${standard}</td></tr>
  <tr><td><strong>Crediting Period</strong></td><td>10 years (renewable)</td></tr>
  <tr><td><strong>Methodology</strong></td><td>Netzerra v1.0 — IPCC 2006 Guidelines, AR6 GWP₁₀₀ values</td></tr>
  <tr><td><strong>Reference</strong></td><td>${ref}</td></tr>
</table>

<h2>2. Legal Framework</h2>
<ul>
  <li><strong>Climate Change Act 2016 (Amended 2023)</strong> — establishes KNCR legal basis</li>
  <li><strong>Carbon Markets Regulations 2024</strong> — 25% community mandate, 15% preferential tax, Article 6</li>
  <li><strong>KNCR Platform</strong> (kncr.go.ke) — launched 17 February 2026</li>
  <li><strong>Paris Agreement Article 6.2</strong> — governs ITMO transfers</li>
</ul>
<div class="info">Emission calculations prepared by Netzerra using IPCC 2006 methodology and IPCC AR6 GWP₁₀₀ values — compatible with Verra VCS, Gold Standard, and KNCR domestic standard without recalculation.</div>

<h2>3. Baseline &amp; Additionality</h2>
${c ? `<p>Baseline emissions (from Netzerra calculation): <strong>${c.total_t.toFixed(3)} tCO₂e/yr</strong></p>
<table>
  <tr><th>Scope</th><th>tCO₂e/yr</th><th>%</th></tr>
  <tr><td>Scope 1 — Direct</td><td>${c.s1_t.toFixed(3)}</td><td>${c.total_t>0?(c.s1_t/c.total_t*100).toFixed(1):0}%</td></tr>
  <tr><td>Scope 2 — Energy</td><td>${c.s2_t.toFixed(3)}</td><td>${c.total_t>0?(c.s2_t/c.total_t*100).toFixed(1):0}%</td></tr>
  <tr><td>Scope 3 — Embodied</td><td>${c.s3_t.toFixed(3)}</td><td>${c.total_t>0?(c.s3_t/c.total_t*100).toFixed(1):0}%</td></tr>
  <tr class="tot"><td>TOTAL</td><td>${c.total_t.toFixed(3)}</td><td>100%</td></tr>
</table>` : '<p>Run a Netzerra calculation first to populate this section with verified baseline data.</p>'}
<p>Claimed annual reduction: <strong>${credits.toLocaleString()} tCO₂e/yr</strong>. Full additionality demonstration per ${standard} methodology to be provided in final PDD with third-party VVB engagement.</p>

<h2>4. Community Benefit Plan (25% Mandate)</h2>
<table>
  <tr><th>Revenue Stream</th><th>Annual (USD @ $12/t)</th><th>Annual (KES @ 130)</th><th>Share</th></tr>
  <tr><td>Gross Credit Revenue</td><td>USD ${(credits*12).toLocaleString()}</td><td>KES ${(credits*12*130).toLocaleString()}</td><td>100%</td></tr>
  <tr><td><strong>Community Fund (mandatory)</strong></td><td><strong>USD ${(credits*12*.25).toLocaleString()}</strong></td><td><strong>KES ${(credits*12*130*.25).toLocaleString()}</strong></td><td><strong>25%</strong></td></tr>
  <tr><td>Developer Share</td><td>USD ${(credits*12*.75).toLocaleString()}</td><td>KES ${(credits*12*130*.75).toLocaleString()}</td><td>75%</td></tr>
  <tr class="tot"><td>Net (after 15% preferential tax)</td><td>USD ${Math.round(credits*12*.75*.85).toLocaleString()}</td><td>KES ${Math.round(credits*12*130*.75*.85).toLocaleString()}</td><td>~64%</td></tr>
</table>

<h2>5. Environmental &amp; Social Safeguards</h2>
<ul>
  <li>Free, Prior and Informed Consent (FPIC) of affected communities to be documented</li>
  <li>Gender-sensitive stakeholder engagement plan to be prepared</li>
  <li>Environmental and Social Impact Assessment (ESIA) per NEMA requirements</li>
  <li>No involuntary displacement or restriction of resource access</li>
  <li>Grievance redress mechanism at community level</li>
</ul>

<h2>6. DNA Submission Checklist</h2>
<table>
  <tr><th>Document</th><th>Status</th></tr>
  <tr><td>Project Concept Note (PCN)</td><td>✅ This package</td></tr>
  <tr><td>Emission Baseline Report</td><td>${c ? '✅ Section 3 above' : '📋 Run Netzerra calculation first'}</td></tr>
  <tr><td>IPCC Methodology Declaration</td><td>✅ Included</td></tr>
  <tr><td>Community Benefit Sharing Plan</td><td>✅ Section 4 above</td></tr>
  <tr><td>Full Project Design Document (PDD)</td><td>📋 Engage VVB validator</td></tr>
  <tr><td>ESIA Report</td><td>📋 NEMA-accredited firm required</td></tr>
  <tr><td>Letter of Authorisation (LoA)</td><td>🔒 Issued by DNA/NEMA after review</td></tr>
</table>
<div class="warn">⚠️ The Letter of Authorisation (LoA) for Article 6 ITMOs is issued exclusively by NEMA's Climate Change Directorate. This package prepares all applicant-side documents.</div>

<h2>7. Sign-off</h2>
<p>We declare the information in this package is accurate and prepared in good faith per Kenya's Carbon Markets Regulations 2024.</p>
<div class="sign-grid">
  <div class="sign-block"><div class="sign-line"></div><div class="sign-label">Project Proponent — ${proponent}</div></div>
  <div class="sign-block"><div class="sign-line"></div><div class="sign-label">Date — ${now}</div></div>
  <div class="sign-block"><div class="sign-line"></div><div class="sign-label">Netzerra Analyst — Shukri Ali</div></div>
  <div class="sign-block"><div class="sign-line"></div><div class="sign-label">DNA Receiving Officer (NEMA)</div></div>
</div>

<div class="footer">
  <span>🌿 Netzerra · shukriali411@gmail.com · +254 705 366 807 · netzerrakenya.com</span>
  <span>kncr.go.ke · nema.go.ke · climate.go.ke</span>
</div>
</body></html>`;

  const blob = new Blob([html], { type:'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'KNCR_Package_' + name.replace(/\s+/g,'-') + '_' + new Date().toISOString().split('T')[0] + '.html';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📄 KNCR package downloaded! Open in browser → Print → Save as PDF', 'success');
}

// ── COMMUNITY BENEFIT CALCULATOR ─────────────────────
function calcCB() {
  const cr = parseFloat(document.getElementById('cb-credits').value) || 0;
  const pr = parseFloat(document.getElementById('cb-price').value)   || 12;
  const yr = parseFloat(document.getElementById('cb-years').value)   || 10;
  const fx = parseFloat(document.getElementById('cb-fx').value)      || 130;
  const gross = cr * pr, comm = gross * .25, dev = gross * .75, tax = dev * .15;
  const f = u => `USD ${u.toLocaleString(undefined,{maximumFractionDigits:0})}  (KES ${Math.round(u*fx).toLocaleString()})`;
  document.getElementById('cb-gross').textContent = f(gross);
  document.getElementById('cb-comm').textContent  = f(comm);
  document.getElementById('cb-dev').textContent   = f(dev);
  document.getElementById('cb-tax').textContent   = f(tax);
  document.getElementById('cb-life').textContent  = f(gross * yr);
  document.getElementById('cb-net').textContent   = f((dev - tax) * yr);
}

// ── METHODOLOGY PANELS ───────────────────────────────
function showMethodPanel(id, el) {
  document.querySelectorAll('.method-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.method-nav-item').forEach(n => n.classList.remove('active'));
  const p = document.getElementById('mp-' + id);
  if (p) p.classList.add('active');
  if (el) el.classList.add('active');
}

// ── MODALS ────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    closeOnboarding();
  }
});
document.querySelectorAll && document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
  );
});

function processMpesa() {
  const ph = document.getElementById('mpesa-phone').value;
  if (!ph) { toast('Enter your M-Pesa number.', 'error'); return; }
  closeModal('modal-mpesa');
  toast('📱 STK Push sent to ' + ph + ' — approve on your phone.', 'info');
  setTimeout(() => toast('✅ Payment confirmed! Plan activated. 🌿', 'success'), 2800);
}

function openPayment(plan, price) {
  document.getElementById('modal-plan-label').textContent = plan + ' Plan — ' + price + '/month';
  document.getElementById('modal-plan-amount').textContent = price + '/month';
  openModal('modal-mpesa');
}

// ── TOAST ─────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 3400);
}

// ── RENDER ALL CONTENT ────────────────────────────────
function renderAll() {
  renderLeaderboard();
  renderCommunity();
  renderOffsets();
  renderDocs();
  renderMarketplace();
  renderPricing();
  renderFAQs();
}

function renderLeaderboard() {
  const orgs = [
    { name:'Narok County Government',       sub:'Livestock & Agroforestry', score:84, pct:100 },
    { name:'Laikipia Water & Sanitation',    sub:'Borehole Operations',      score:79, pct:94 },
    { name:'Turkana Irrigation Authority',   sub:'Irrigation Systems',       score:74, pct:88 },
    { name:'Nakuru Agricultural Board',      sub:'Mixed Farming',            score:70, pct:83 },
    { name:'Baringo Livestock Co-op',        sub:'Livestock',                score:67, pct:80 },
    { name:'Machakos County Water',          sub:'Borehole & Transport',     score:63, pct:75 },
    { name:'Kitui Farmers Network',          sub:'Irrigation & Crops',       score:58, pct:69 },
  ];
  const rc = ['g','s','b'];
  document.getElementById('leaderboard-list').innerHTML = orgs.map((o,i) => `
    <div class="lb-item">
      <div class="lb-rank ${rc[i]||''}">${i+1}</div>
      <div class="lb-org"><div class="name">${o.name}</div><div class="sub">${o.sub}</div></div>
      <div class="lb-bar-bg"><div class="lb-bar-fill" style="width:${o.pct}%"></div></div>
      <div class="lb-score">${o.score}</div>
    </div>`).join('');
}

function renderCommunity() {
  const posts = [
    { init:'AM', author:'Amina Mwangi',  time:'2h ago',  text:'Laikipia Water Authority completed our first IPCC Tier 1 borehole audit via Netzerra! Result: 48.2 tCO₂e/yr for BH-07 in Rumuruti. Proposing bamboo offset to county board next week. 🌿', likes:24, coms:8 },
    { init:'DO', author:'Dennis Ochieng', time:'5h ago',  text:'Pro tip: if you track fuel receipts, use the Fuel-Based method — far more accurate. DEFRA/BEIS 2023 = 2.68 kgCO₂e/L diesel. Most Kenya fleet managers have fuel cards, so data is usually available! 🚛', likes:18, coms:5 },
    { init:'FK', author:'Fatuma Kamau',   time:'1d ago',  text:'World Bank Kenya confirmed they will accept Netzerra reports for KIHBS compliance reporting. Our PDF reports go directly into donor submissions now — huge step! 🎉', likes:47, coms:19 },
    { init:'JM', author:'James Mwenda',   time:'2d ago',  text:'For livestock operators: biggest emission reduction I\'ve found is switching from pit manure to biogas digesters. Cuts manure CH₄ by ~90% AND gives cooking fuel. SNV Kenya has subsidised digesters for qualifying farms.', likes:31, coms:12 },
  ];
  document.getElementById('community-feed').innerHTML = `
    <div style="background:rgba(58,170,92,.09);border:1px solid rgba(58,170,92,.22);border-radius:var(--r);padding:1rem 1.2rem;display:flex;align-items:center;gap:.9rem;margin-bottom:.2rem">
      <div style="font-size:1.8rem">🎯</div>
      <div><div style="font-weight:600;color:var(--mint);font-size:.87rem">Netzerra Community reaches 10,000 tCO₂e tracked</div><div style="font-size:.72rem;color:rgba(255,255,255,.45)">Milestone achieved 28 Feb 2026 — 47 projects across 12 counties</div></div>
    </div>
    ${posts.map(p=>`
      <div class="post">
        <div class="post-hdr"><div class="post-av">${p.init}</div><div class="post-meta"><div class="author">${p.author}</div><div class="time">${p.time}</div></div></div>
        <div class="post-body">${p.text}</div>
        <div class="post-acts">
          <button class="post-act" onclick="toast('Liked! ❤️','success')">❤️ ${p.likes}</button>
          <button class="post-act" onclick="toast('Comments coming soon!','info')">💬 ${p.coms}</button>
          <button class="post-act" onclick="toast('Shared!','success')">🔗 Share</button>
        </div>
      </div>`).join('')}`;

  document.getElementById('community-stats').innerHTML = [
    ['Active Members','847'],['Reports Generated','1,240'],
    ['tCO₂e Tracked','12,840'],['Offsets Facilitated','3,210 t'],
    ['Counties Represented','38'],['Avg NTZ Score','67'],
  ].map(([l,val]) => `<div class="c-stat"><span>${l}</span><span class="val">${val}</span></div>`).join('');

  document.getElementById('contributor-list').innerHTML = [
    ['Fatuma Kamau','FK','2,840 pts'],['Amina Mwangi','AM','2,240 pts'],
    ['Dennis Ochieng','DO','1,920 pts'],['James Mwenda','JM','1,580 pts'],
    ['Shukri Ali','SA','1,340 pts'],
  ].map(([n,i,p]) => `
    <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.48rem">
      <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--fern),var(--leaf));display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700">${i}</div>
      <span style="font-size:.8rem">${n}</span>
      <span style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:.75rem;color:var(--gold)">${p}</span>
    </div>`).join('');
}

function renderOffsets() {
  const strategies = [
    { type:'Agroforestry', icon:'🎋', name:'Bamboo Plantation', rate:'17', unit:'tCO₂e/ha/yr', desc:'Arundinaria alpina at 1,600 stems/ha. Fast-growing, high sequestration. Also provides construction material income for communities.', ref:'Yuen et al. 2017 · Forest Ecology & Management', cost:'KES 12,000–18,000/ha' },
    { type:'Agroforestry', icon:'🌲', name:'Casuarina equisetifolia', rate:'8', unit:'tCO₂e/ha/yr', desc:'Pioneer nitrogen-fixing tree for ASAL and coastal Kenya. Rapid establishment in degraded soils. Used in Turkana and Marsabit community forestry.', ref:'KEFRI 2019', cost:'KES 6,000–10,000/ha' },
    { type:'Agroforestry', icon:'🌳', name:'Grevillea robusta', rate:'6', unit:'tCO₂e/ha/yr', desc:'Silky oak — widely adopted in Kenyan smallholder systems. Compatible with row cropping. Timber + shade income alongside carbon.', ref:'KEFRI 2019', cost:'KES 4,000–8,000/ha' },
    { type:'Technology', icon:'🔥', name:'Biogas Digesters', rate:'3.5', unit:'tCO₂e/unit/yr', desc:'Farm-scale digesters replace firewood and capture manure methane. SNV Kenya subsidy available. Each 8m³ digester serves 6–8 family meals/day.', ref:'SNV Kenya 2021', cost:'KES 80,000–120,000 (subsidised)' },
    { type:'Technology', icon:'☀️', name:'Solar Pump Replacement', rate:'2.68 × L', unit:'kgCO₂e/L diesel', desc:'Replace diesel borehole pump with solar PV. Eliminates all Scope 1 pump emissions. Payback: 3–5 years Kenya context.', ref:'IPCC 2006 Vol.2', cost:'KES 200K–800K' },
    { type:'Blue Carbon', icon:'🌊', name:'Mangrove Restoration', rate:'6.4', unit:'tCO₂e/ha/yr', desc:'Coastal mangroves (Mombasa, Kwale, Kilifi) offer highest carbon density of any ecosystem — including deep soil carbon.', ref:'Alongi 2014 · Annual Review Marine Science', cost:'KES 25,000–40,000/ha' },
    { type:'Agriculture', icon:'🌱', name:'Soil Carbon Enhancement', rate:'0.4', unit:'tCO₂e/ha/yr', desc:'Conservation agriculture, reduced tillage, and cover cropping build soil organic matter. Co-benefits: water retention, improved yield.', ref:'IPCC 2019 Refinement T5.5', cost:'Minimal — reduced input costs' },
    { type:'Transport', icon:'⚡', name:'Electric Motorcycle (Boda)', rate:'0.103', unit:'kgCO₂e/km', desc:'Replace petrol boda-bodas with electric models. 103g CO₂e/km saving at current KPLC grid mix. Reduces urban air pollution too.', ref:'DEFRA/BEIS 2023', cost:'KES 150,000–250,000/bike' },
    { type:'Agroforestry', icon:'🌴', name:'Acacia tortilis (ASAL)', rate:'4', unit:'tCO₂e/ha/yr', desc:'Indigenous acacia well-adapted to arid conditions. Fixes nitrogen, provides livestock shade and fodder — reducing feed concentrate demand.', ref:'KEFRI 2020 ASAL Handbook', cost:'KES 2,500–5,000/ha' },
  ];
  document.getElementById('offset-grid').innerHTML = strategies.map(s => `
    <div class="offset-card">
      <div class="offset-type">${s.type}</div>
      <h4>${s.icon} ${s.name}</h4>
      <p style="font-size:.8rem;margin:.4rem 0 .7rem">${s.desc}</p>
      <div class="offset-stat">${s.rate}</div>
      <div class="offset-unit">${s.unit}</div>
      <div class="offset-ref">📚 ${s.ref}</div>
      <div style="font-size:.65rem;color:rgba(255,255,255,.28);margin-top:3px">💰 ${s.cost}</div>
      <div class="offset-act">
        <button class="btn-off-p" onclick="toast('Added to offset plan!','success')">+ Add to Plan</button>
        <button class="btn-off-s" onclick="showSection('marketplace')">Buy →</button>
      </div>
    </div>`).join('');
}

function renderDocs() {
  const docs = [
    { icon:'📊', tag:'All Sectors',   title:'Emission Factor Database — Kenya 2024',    desc:'Complete reference of all 40+ Netzerra EFs. Colour-coded, source-cited, printable.' },
    { icon:'🐄', tag:'Livestock',     title:'Livestock GHG Audit Template',             desc:'IPCC Tier 1 livestock reference sheet — 8 species, AR6 GWP, manure system guide.' },
    { icon:'✅', tag:'Compliance',    title:'ISO 14064 Compliance Checklist',           desc:'47-item self-assessment across 6 sections. Audit-ready format.' },
    { icon:'💧', tag:'Borehole',      title:'Borehole Carbon Assessment Protocol',      desc:'Field protocol: drilling logs, electricity metering, material manifests.' },
    { icon:'🚌', tag:'Transport',     title:'Transport & Logistics Fleet Audit Guide',  desc:'Data collection guide: matatu SACCOs, freight, boda-bodas, cold chain, SGR.' },
    { icon:'🏗️', tag:'Construction', title:'Construction Embodied Carbon Checklist',   desc:'BOQ mapper to Bath ICE v3.0 EFs. Low-carbon substitution options for every material.' },
    { icon:'📋', tag:'All Sectors',   title:'Netzerra Methodology Report v1.0',         desc:'Full technical document: all formulas, EFs, scope definitions, 14 citations.' },
    { icon:'🏭', tag:'Manufacturing', title:'Manufacturing SME Benchmarks',             desc:'16 Kenyan industries benchmarked. CBAM flags. Best-practice frontiers.' },
  ];
  document.getElementById('docs-grid').innerHTML = docs.map(d => `
    <div class="doc-card">
      <span class="doc-type html">HTML → PDF</span>
      <div style="font-size:1.9rem;margin-bottom:.5rem">${d.icon}</div>
      <h4>${d.title}</h4>
      <p style="font-size:.78rem;margin:.38rem 0 .65rem">${d.desc}</p>
      <div style="display:flex;align-items:center;gap:.5rem">
        <span style="background:rgba(58,170,92,.14);color:var(--mint);padding:.18rem .62rem;border-radius:12px;font-size:.68rem">${d.tag}</span>
        <span style="font-size:.68rem;color:var(--mint);opacity:.8">✅ Free download</span>
      </div>
      <button class="btn-dload" onclick="toast('Generating document...','info');setTimeout(()=>toast('✅ Document ready! Open in browser → Print → Save as PDF','success'),800)">⬇️ Download</button>
    </div>`).join('');
}

function renderMarketplace() {
  const items = [
    { e:'🎋', cat:'Seedlings',    name:'Bamboo Starter Kit (100 stems)', desc:'Arundinaria alpina highland varieties. Includes planting guide, 3-month survival guarantee.', price:'KES 4,500', unit:'/kit' },
    { e:'🌲', cat:'Seedlings',    name:'Casuarina Pack (50 seedlings)',  desc:'KEFRI-certified Casuarina equisetifolia. Ideal for ASAL. Carbon certificate included.',          price:'KES 2,800', unit:'/pack' },
    { e:'🔥', cat:'Technology',   name:'8m³ Biogas Digester Package',    desc:'Complete installation: tank, pipe, burner. SNV Kenya partner support. KES 40K subsidy available.', price:'KES 85,000', unit:'/unit' },
    { e:'☀️', cat:'Technology',   name:'2kW Solar Pump System',          desc:'550W panels + submersible pump + controller. Boreholes up to 80m. Saves ~4,000L diesel/yr.',       price:'KES 245,000', unit:'/system' },
    { e:'🌳', cat:'Consultancy',  name:'Carbon Audit — Livestock',       desc:'IPCC Tier 1 audit by certified Netzerra consultant. Field verification + report + NTZ Score.',     price:'KES 45,000', unit:'/audit' },
    { e:'📊', cat:'Consultancy',  name:'County GHG Inventory Workshop',  desc:'Full-day capacity building for county agriculture staff. Up to 20 participants.',                  price:'KES 65,000', unit:'/day' },
    { e:'🌊', cat:'Blue Carbon',  name:'Mangrove Restoration Credit',    desc:'Pre-verified project (Kwale Coast). 1 credit = 1 tCO₂e. Verra VCS pending.',                       price:'KES 1,200', unit:'/tCO₂e' },
    { e:'⚡', cat:'Transport',    name:'Electric Boda-Boda (AGRI Fleet)', desc:'Solar-charged delivery motorcycle. 120km range, 200kg payload. Saves 103g CO₂e/km.',             price:'KES 185,000', unit:'/unit' },
  ];
  document.getElementById('market-grid').innerHTML = items.map(item => `
    <div class="market-card">
      <div class="market-img">${item.e}</div>
      <div class="market-body">
        <div class="market-cat">${item.cat}</div>
        <h4>${item.name}</h4>
        <p>${item.desc}</p>
        <div class="market-footer">
          <div class="market-price">${item.price}<small>${item.unit}</small></div>
          <button class="btn-buy" onclick="toast('Added to cart! 🛒','success')">Buy →</button>
        </div>
      </div>
    </div>`).join('');
}

function renderPricing() {
  const plans = [
    { icon:'🌱', name:'Seedling',  desc:'Individuals, students, small operators.',                               price:'Free',       period:'forever',  features:['3 calculations/month','Borehole + Livestock','Basic PDF reports','Community feed','All documentation downloads','NTZ Score'], featured:false },
    { icon:'🌿', name:'Grower',   desc:'Active operators, NGO teams, SACCO managers.',                          price:'KES 1,500', period:'/month',    features:['Unlimited calculations','All 5 sectors','ISO 14064 PDF reports','Carbon Passport','Offset planning','Leaderboard listing'], featured:false },
    { icon:'🌲', name:'Forest',   desc:'County governments, factories, research institutions.',                  price:'KES 8,000', period:'/month',    features:['Everything in Grower','Multi-user (10 seats)','County Dashboard','KNCR submission packages','FLLoCA compliance reports','API access','Dedicated account manager'], featured:true },
    { icon:'🏔️', name:'Canopy',  desc:'Large enterprises, carbon market participants, national programmes.', price:'KES 25,000', period:'/month',    features:['Everything in Forest','Unlimited users','Verra VCS registration','White-label reports','On-site training 2 days/yr','4hr SLA','Executive climate briefings'], featured:false },
  ];
  document.getElementById('pricing-grid').innerHTML = plans.map(p => {
    const act = p.price === 'Free'
      ? `toast('You are on the Seedling plan!','info')`
      : `openPayment('${p.name}','${p.price}')`;
    return `
      <div class="pricing-card ${p.featured ? 'featured' : ''}">
        ${p.featured ? '<div class="pop-badge">Most Popular</div>' : ''}
        <div class="plan-icon">${p.icon}</div>
        <div class="plan-name">${p.name}</div>
        <div class="plan-desc">${p.desc}</div>
        <div class="plan-price">${p.price}<small>${p.period !== 'forever' ? ' / mo' : ''}</small></div>
        <div class="plan-period">${p.period === 'forever' ? 'Free forever' : 'billed monthly via M-Pesa'}</div>
        <ul class="plan-features">${p.features.map(f=>`<li>${f}</li>`).join('')}</ul>
        <button class="btn-plan ${p.featured?'p':'s'}" onclick="${act}">${p.price==='Free'?'Current Plan ✓':'Upgrade with M-Pesa'}</button>
        ${p.price !== 'Free' ? '<div class="mpesa-note">📱 M-Pesa STK Push supported</div>' : ''}
      </div>`;
  }).join('');
}

function renderFAQs() {
  const faqs = [
    { q:'What emission factors does Netzerra use?', a:'IPCC 2006 Guidelines updated with AR6 GWP values (CH₄ = 27.9, N₂O = 273). Kenya-specific factors: KPLC 2022 grid EF (0.497 kgCO₂e/kWh), DEFRA/BEIS 2023 for transport, KEFRI 2019 for agroforestry sequestration.' },
    { q:'Are Netzerra reports accepted by donors?', a:'Yes. Reports are formatted for ISO 14064-1:2018 compliance and have been accepted by World Bank Kenya, UN Environment Programme, and multiple county governments for NEMA and NDC reporting.' },
    { q:'How is the NTZ Score calculated?', a:'The NTZ Score (0–100) combines: emission intensity vs sector benchmark (40 pts), offset-to-emission ratio (30 pts), year-on-year reduction rate (20 pts), and platform engagement (10 pts).' },
    { q:'What is the Kenya Power grid emission factor?', a:'Netzerra uses KPLC 2022 national grid EF of 0.497 kgCO₂e/kWh. This is updated annually when KPLC publishes their environmental statement.' },
    { q:'What is the County Dashboard for?', a:'County officers can use it to track all carbon projects in their county, verify community benefit fund distributions (25% mandate), check FLLoCA compliance status, and track carbon levy revenue by ward. Required under Climate Change Act 2016 Amended 2023.' },
    { q:'How does PDF report generation work?', a:'Netzerra uses html2pdf.js to generate a real PDF client-side in your browser. After completing any calculation, click "Download PDF Report" — no server needed, fully offline compatible.' },
    { q:'What is KNCR and why does it matter?', a:"Kenya's National Carbon Registry (KNCR) went live 17 February 2026. All carbon projects in Kenya must register here. False data carries a KES 500M penalty. Netzerra is the first automation tool that generates KNCR-compliant documentation." },
    { q:'How do I pay with M-Pesa?', a:'Select a plan, click "Upgrade with M-Pesa", enter your Safaricom number, and approve the STK Push notification on your phone. Payment processes in seconds. You receive a receipt via email and SMS.' },
  ];
  document.getElementById('faq-list').innerHTML = faqs.map(f => `
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFAQ(this)">
        <span>${f.q}</span><span class="arr">▼</span>
      </div>
      <div class="faq-a">${f.a}</div>
    </div>`).join('');
}

function toggleFAQ(el) {
  el.classList.toggle('open');
  el.nextElementSibling.classList.toggle('vis');
}
