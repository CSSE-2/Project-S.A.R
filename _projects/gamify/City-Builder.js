// ═══════════════════════════════════════════════════════════
// CORE SETUP
// ═══════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let CW, CH;

function resize() {
  const wrap = document.getElementById('canvasWrap');
  CW = wrap.clientWidth;
  CH = wrap.clientHeight;
  canvas.width = CW;
  canvas.height = CH;
}
resize();
window.addEventListener('resize', resize);

const TILE = 32;
const COLS = 100;
const GROUND_Y = () => CH - 40;

// Data structures
const grid = {};
const roadGrid = {};
const tollGrid = {};
let money = 10000;
let day = 1;
let timeOfDay = 6;
let speed = 1;
let selectedTool = 'none';
let hoverCol = -1;
let population = 0;
let happiness = 100;
let powerBalance = 0;
let netIncome = 0;
let tollToday = 0;
let totalPop = 0;
let camX = 0;
let viewMode = 'side';
let lastTs = 0;

// Entities
let workers = [];
let walkers = [];
let cars = [];
let clouds = [];
let particles = [];

// Initialize clouds
for (let i = 0; i < 12; i++) {
  clouds.push({
    x: Math.random() * CW * 2,
    y: 20 + Math.random() * 80,
    s: 0.5 + Math.random() * 0.8,
    sp: 0.2 + Math.random() * 0.5
  });
}

// ═══════════════════════════════════════════════════════════
// BUILDING DEFINITIONS
// ═══════════════════════════════════════════════════════════
const BDEFS = {
  cottage: {w:2, h:2, color:'#d4a574', roof:'#8b4513', pop:3, income:5, hap:2, pwr:0, upkeep:1, cost:150, label:'COTTAGE', unlock:0},
  house: {w:2, h:3, color:'#c87941', roof:'#8b3a3a', pop:6, income:10, hap:3, pwr:1, upkeep:2, cost:250, label:'HOUSE', unlock:0},
  villa: {w:3, h:3, color:'#e6c294', roof:'#774422', pop:10, income:15, hap:5, pwr:2, upkeep:4, cost:600, label:'VILLA', unlock:50},
  apartment: {w:3, h:6, color:'#5577aa', roof:'#334466', pop:30, income:35, hap:2, pwr:4, upkeep:7, cost:800, label:'APARTMENT', unlock:100},
  skyscraper: {w:4, h:14, color:'#445566', roof:'#223344', pop:80, income:90, hap:0, pwr:10, upkeep:20, cost:2000, label:'TOWER', unlock:300},
  shop: {w:2, h:3, color:'#cc8844', roof:'#885522', pop:0, income:45, hap:5, pwr:2, upkeep:5, cost:400, label:'SHOP', unlock:0},
  market: {w:3, h:3, color:'#bb6633', roof:'#773311', pop:0, income:80, hap:6, pwr:3, upkeep:8, cost:700, label:'MARKET', unlock:80},
  office: {w:3, h:8, color:'#446677', roof:'#223344', pop:0, income:100, hap:1, pwr:6, upkeep:12, cost:1200, label:'OFFICE', unlock:150},
  factory: {w:4, h:4, color:'#776655', roof:'#554433', pop:0, income:70, hap:-5, pwr:8, upkeep:9, cost:600, label:'FACTORY', unlock:0},
  park: {w:2, h:1, color:'#3a8a3a', roof:'#2a6a2a', pop:0, income:0, hap:12, pwr:0, upkeep:3, cost:150, label:'PARK', unlock:0},
  school: {w:3, h:3, color:'#cc9933', roof:'#996622', pop:0, income:0, hap:8, pwr:2, upkeep:8, cost:700, label:'SCHOOL', unlock:60},
  hospital: {w:3, h:4, color:'#eeeeff', roof:'#bbbbcc', pop:0, income:0, hap:15, pwr:3, upkeep:12, cost:1100, label:'HOSPITAL', unlock:120},
  police: {w:2, h:3, color:'#334488', roof:'#112266', pop:0, income:0, hap:7, pwr:1, upkeep:6, cost:500, label:'POLICE', unlock:40},
  road: {w:1, h:0, color:'#444', roof:'#333', pop:0, income:0, hap:0, pwr:0, upkeep:1, cost:50, label:'ROAD', unlock:0},
  tollbooth: {w:1, h:2, color:'#ff8800', roof:'#cc5500', pop:0, income:0, hap:-2, pwr:0, upkeep:2, cost:800, label:'TOLL', unlock:30},
  powerplant: {w:4, h:3, color:'#886644', roof:'#664422', pop:0, income:0, hap:-4, pwr:-30, upkeep:18, cost:1500, label:'POWER', unlock:200},
};

const UNLOCKED = new Set(['cottage', 'house', 'shop', 'factory', 'park', 'road', 'custom']);

// ═══════════════════════════════════════════════════════════
// EXPAND/MINIMIZE
// ═══════════════════════════════════════════════════════════
function toggleExpand() {
  const app = document.getElementById('app');
  const btn = document.getElementById('toggleBtn');
  
  if (app.classList.contains('expanded')) {
    app.classList.remove('expanded');
    btn.textContent = '⬆️ EXPAND';
  } else if (app.classList.contains('minimized')) {
    app.classList.remove('minimized');
    btn.textContent = '⬆️ EXPAND';
  } else {
    app.classList.add('expanded');
    btn.textContent = '⬇️ MINIMIZE';
  }
  
  setTimeout(resize, 300);
}

// Quick minimize on Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const app = document.getElementById('app');
    if (!app.classList.contains('minimized')) {
      app.classList.add('minimized');
      document.getElementById('toggleBtn').textContent = '⬆️ OPEN';
    }
  }
});

// ═══════════════════════════════════════════════════════════
// STATS & UNLOCKS
// ═══════════════════════════════════════════════════════════
function calcStats() {
  population = 0;
  let rawHap = 50;
  let pwrUsed = 0;
  let pwrGen = 0;
  let upkeep = 0;
  let inc = 0;

  for (const b of Object.values(grid)) {
    const d = BDEFS[b.type] || b.customDef;
    if (!d) continue;
    population += d.pop;
    rawHap += d.hap;
    if (d.pwr < 0) pwrGen += Math.abs(d.pwr);
    else pwrUsed += d.pwr;
    inc += d.income;
    upkeep += d.upkeep;
  }

  upkeep += Object.keys(roadGrid).length + Object.keys(tollGrid).length * 2;
  powerBalance = pwrGen - pwrUsed;
  happiness = Math.max(0, Math.min(100, rawHap));
  
  if (powerBalance < 0) happiness = Math.max(0, happiness - 20);
  
  netIncome = inc - upkeep;
  totalPop = Math.max(totalPop, population);
  checkUnlocks();
}

function checkUnlocks() {
  for (const [id, def] of Object.entries(BDEFS)) {
    if (def.unlock <= totalPop && !UNLOCKED.has(id)) {
      UNLOCKED.add(id);
      const btn = document.getElementById('t_' + id);
      if (btn) {
        btn.classList.remove('locked');
        const lock = btn.querySelector('.lk');
        if (lock) lock.remove();
      }
      showPopup('🎉 UNLOCKED: ' + def.label + '!');
      createParticles(CW / 2, CH / 2, 20);
    }
  }
}

function updateHUD() {
  calcStats();
  document.getElementById('money').textContent = '$' + money.toLocaleString();
  document.getElementById('pop').textContent = population;
  document.getElementById('hap').textContent = happiness + '%';
  
  const totalInc = netIncome + tollToday;
  document.getElementById('inc').textContent = (totalInc >= 0 ? '+' : '') + totalInc + '/d';
  document.getElementById('inc').style.color = totalInc >= 0 ? 'var(--green)' : 'var(--red)';
  
  const h = Math.floor(timeOfDay);
  const m = Math.floor((timeOfDay % 1) * 60);
  document.getElementById('clock').textContent = `DAY ${day} — ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  
  // Stats panel
  document.getElementById('popBar').style.width = Math.min(100, population / 500 * 100) + '%';
  document.getElementById('popN').textContent = population;
  document.getElementById('hapBar').style.width = happiness + '%';
  document.getElementById('hapN').textContent = happiness + '%';
  
  const pp = powerBalance >= 0 ? 100 : Math.max(0, 100 + powerBalance * 3);
  document.getElementById('powBar').style.width = pp + '%';
  document.getElementById('powN').textContent = (powerBalance >= 0 ? '+' : '') + powerBalance;
  
  document.getElementById('bldN').textContent = Object.keys(grid).length;
  document.getElementById('rdN').textContent = Object.keys(roadGrid).length + Object.keys(tollGrid).length;
  document.getElementById('tollN').textContent = '$' + tollToday;
  
  // Night overlay
  const t = timeOfDay;
  let darkness = 0;
  if (t >= 20) darkness = (t - 20) / 4 * 0.7;
  else if (t < 6) darkness = 0.7 - t / 6 * 0.7;
  document.getElementById('nightOv').style.background = `rgba(0, 0, 40, ${darkness})`;
}

// ═══════════════════════════════════════════════════════════
// DAY CYCLE
// ═══════════════════════════════════════════════════════════
const DAY_LENGTHS = [0, 30, 15, 6];

function dayTick(dt) {
  if (speed === 0) return;
  const dayLen = DAY_LENGTHS[speed];
  timeOfDay += dt / dayLen * 24;
  
  if (timeOfDay >= 24) {
    timeOfDay -= 24;
    day++;
    money += netIncome + tollToday;
    tollToday = 0;
    
    if (walkers.length < Math.min(population * 0.3, 50)) spawnWalker();
    if (cars.length < 10 && Object.keys(roadGrid).length > 0 && Math.random() < 0.8) spawnCar();
  }
}

// ═══════════════════════════════════════════════════════════
// SPAWNERS
// ═══════════════════════════════════════════════════════════
function spawnWalker() {
  const colors = ['#ffaaaa', '#aaffaa', '#aaaaff', '#ffffaa', '#ffaaff', '#aaffff'];
  walkers.push({
    x: Math.random() * COLS * TILE,
    dir: Math.random() < 0.5 ? 1 : -1,
    frame: 0,
    ft: 0,
    color: colors[Math.floor(Math.random() * colors.length)]
  });
}

function spawnCar() {
  const colors = ['#ff4444', '#4444ff', '#ffff44', '#44ff44', '#ff8844', '#cc44cc'];
  const dir = Math.random() < 0.5 ? 1 : -1;
  cars.push({
    x: dir > 0 ? -60 : COLS * TILE + 60,
    dir,
    tolled: false,
    color: colors[Math.floor(Math.random() * colors.length)]
  });
}

function spawnWorkers(col, def) {
  const n = Math.min(5, def.w + 1);
  for (let i = 0; i < n; i++) {
    workers.push({
      col,
      x: col * TILE + i * (def.w * TILE / n),
      y: GROUND_Y() - 4,
      frame: 0,
      ft: 0
    });
  }
}

function createParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 5 - 2,
      life: 1
    });
  }
}

// ═══════════════════════════════════════════════════════════
// TOLL SYSTEM
// ═══════════════════════════════════════════════════════════
function checkToll(car) {
  const col = Math.floor(car.x / TILE);
  if (tollGrid[col] && !car.tolled) {
    car.tolled = true;
    const earn = Math.floor(8 + Math.random() * 22);
    tollToday += earn;
    money += earn;
    showTollNotif('+$' + earn + ' TOLL 💰');
    createParticles(car.x - camX, GROUND_Y(), 10);
  }
}

let tollNotifTimeout = null;
function showTollNotif(msg) {
  const el = document.getElementById('tollNotif');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(tollNotifTimeout);
  tollNotifTimeout = setTimeout(() => el.classList.remove('show'), 1800);
}

// ═══════════════════════════════════════════════════════════
// DRAWING
// ═══════════════════════════════════════════════════════════
function wx(col) {
  return col * TILE - camX;
}

function skyColor() {
  const t = timeOfDay;
  if (t >= 5 && t < 8) return lerpColor('#0a0a1a', '#ff8844', (t - 5) / 3);
  if (t >= 8 && t < 17) return lerpColor('#ff8844', '#4da6ff', (t - 8) / 9);
  if (t >= 17 && t < 20) return lerpColor('#4da6ff', '#ff5522', (t - 17) / 3);
  if (t >= 20 && t < 22) return lerpColor('#ff5522', '#0a0a1a', (t - 20) / 2);
  return '#0a0a1a';
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 255, ag = (ah >> 8) & 255, ab = ah & 255;
  const br = (bh >> 16) & 255, bg = (bh >> 8) & 255, bb = bh & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${b2})`;
}

function drawCloud(x, y, s) {
  ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + s * 0.3})`;
  const parts = [
    {dx: 0, dy: 0, r: 18},
    {dx: 16, dy: -6, r: 14},
    {dx: -16, dy: -4, r: 12},
    {dx: 26, dy: 2, r: 10},
    {dx: -24, dy: 2, r: 9}
  ];
  parts.forEach(p => {
    ctx.beginPath();
    ctx.arc(x + p.dx * s, y + p.dy * s, p.r * s, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGround() {
  const gy = GROUND_Y();
  
  // Grass
  const grassGrad = ctx.createLinearGradient(0, gy - 10, 0, gy);
  grassGrad.addColorStop(0, '#4a9a3a');
  grassGrad.addColorStop(1, '#3a7a2a');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, gy - 8, CW, 8);
  
  // Road
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, gy, CW, 40);
  
  // Lane marks
  ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
  const offset = (-camX * 2 % 100 + 100) % 100;
  for (let x = offset; x < CW; x += 100) {
    ctx.fillRect(x, gy + 18, 50, 4);
  }
}

function drawBuildingSide(col, b) {
  const def = BDEFS[b.type] || b.customDef;
  if (!def) return;
  
  const sx = wx(col);
  const gy = GROUND_Y();
  const bw = def.w * TILE;
  const bh = def.h * TILE;
  const by = gy - bh;
  const isNight = timeOfDay > 19 || timeOfDay < 7;
  const conProg = b.constructing ? b.conProg : 1;
  
  // Park special case
  if (b.type === 'park') {
    if (b.constructing && conProg < 1) {
      ctx.fillStyle = '#555';
      ctx.fillRect(sx, gy - 8, bw, 8);
      return;
    }
    
    ctx.fillStyle = '#3a8a3a';
    ctx.fillRect(sx, gy - 20, bw, 20);
    ctx.fillStyle = '#2a6a2a';
    ctx.fillRect(sx, gy - 20, bw, 5);
    
    for (let i = 0; i < def.w; i++) {
      const tx = sx + i * TILE + TILE / 2;
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(tx - 3, gy - 36, 6, 16);
      ctx.fillStyle = '#2d8a2d';
      ctx.beginPath();
      ctx.arc(tx, gy - 38, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3aaa3a';
      ctx.beginPath();
      ctx.arc(tx - 4, gy - 42, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  
  if (b.type === 'road') return;
  
  // Construction
  if (b.constructing && conProg < 1) {
    const cH = Math.floor(bh * conProg);
    
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(sx, gy - cH, bw, cH);
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = '#cc9944';
    for (let y = 0; y < cH; y += 12) {
      ctx.fillRect(sx - 3, gy - y - 2, bw + 6, 2);
    }
    for (let x = 0; x < bw; x += 16) {
      ctx.fillRect(sx + x, gy - cH, 2, cH);
    }
    return;
  }
  
  // Custom LEGO building
  if (b.type === 'custom' && b.cells) {
    const cs = TILE * 0.9;
    for (const cell of b.cells) {
      const cx = sx + cell.cx * cs;
      const cy = gy - cell.cy * cs - cs;
      
      ctx.fillStyle = cell.color || def.color;
      ctx.fillRect(cx + 1, cy + 1, cs - 2, cs - 2);
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(cx + 1, cy + cs - 6, cs - 2, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(cx + 1, cy + 1, cs - 2, 4);
      
      const studX = cx + cs / 2;
      const studY = cy + 6;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(studX, studY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cell.color || def.color;
      ctx.beginPath();
      ctx.arc(studX, studY - 1, 4, 0, Math.PI * 2);
      ctx.fill();
      
      if (cell.type === 'window') {
        const lit = isNight ? Math.random() < 0.7 : true;
        ctx.fillStyle = lit && isNight ? '#ffffc0' : '#88ccff';
        ctx.fillRect(cx + 6, cy + 8, cs - 12, cs - 16);
        if (isNight && lit) {
          ctx.fillStyle = 'rgba(255, 255, 180, 0.3)';
          ctx.fillRect(cx + 4, cy + 6, cs - 8, cs - 12);
        }
      }
    }
    return;
  }
  
  // Standard building
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(sx + 5, by + 5, bw, bh);
  
  const bodyGrad = ctx.createLinearGradient(sx, by, sx + bw, by + bh);
  bodyGrad.addColorStop(0, def.color);
  bodyGrad.addColorStop(1, lerpColor(def.color, '#000000', 0.2));
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(sx, by, bw, bh);
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(sx + bw - 8, by, 8, bh);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(sx, by, bw, 10);
  
  const ww = Math.max(5, Math.floor(bw / 6));
  const wCols = Math.max(1, Math.floor((bw - 12) / (ww + 6)));
  const wRows = Math.max(1, Math.floor((bh - 16) / (ww * 1.4 + 6)));
  
  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      const lit = isNight ? (b.winMap && b.winMap[r * 20 + c]) : true;
      const wy = by + 12 + r * (bh - 16) / Math.max(1, wRows);
      const wx2 = sx + 8 + c * (bw - 12) / Math.max(1, wCols);
      
      if (lit && isNight) {
        ctx.fillStyle = 'rgba(255, 255, 180, 0.4)';
        ctx.fillRect(wx2 - ww / 2 - 3, wy - 2, ww + 6, ww * 1.4 + 4);
      }
      
      ctx.fillStyle = lit ? (isNight ? '#ffffc0' : '#aaddff') : '#334466';
      ctx.fillRect(wx2 - ww / 2, wy, ww, ww * 1.4);
      
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx2 - ww / 2, wy, ww, ww * 1.4);
    }
  }
  
  const roofGrad = ctx.createLinearGradient(sx, by - 8, sx, by);
  roofGrad.addColorStop(0, def.roof);
  roofGrad.addColorStop(1, lerpColor(def.roof, '#000000', 0.3));
  ctx.fillStyle = roofGrad;
  ctx.fillRect(sx - 3, by - 10, bw + 6, 12);
  
  if (b.type === 'factory') {
    for (let i = 0; i < 2; i++) {
      const stackX = sx + 12 + i * (bw - 24);
      ctx.fillStyle = '#666';
      ctx.fillRect(stackX, by - 24, 10, 16);
      
      if (speed > 0) {
        ctx.fillStyle = `rgba(140, 140, 140, ${0.3 + Math.sin(Date.now() / 400 + i) * 0.2})`;
        ctx.beginPath();
        ctx.arc(stackX + 5, by - 28, 8 + Math.sin(Date.now() / 300 + i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  
  if (b.type === 'hospital') {
    ctx.fillStyle = '#ff3333';
    const crossX = sx + bw / 2;
    const crossY = by + bh / 2;
    ctx.fillRect(crossX - 3, crossY - 12, 6, 24);
    ctx.fillRect(crossX - 12, crossY - 3, 24, 6);
  }
  
  if (b.type === 'police') {
    ctx.fillStyle = Math.sin(Date.now() / 200) > 0 ? '#4466ff' : '#ff4444';
    ctx.beginPath();
    ctx.arc(sx + bw / 2, by - 12, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  
  if (b.type === 'skyscraper') {
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(sx + bw / 2 - 2, by - 18, 4, 18);
    if (isNight) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(sx + bw / 2, by - 20, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff0000';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  
  if (b.type === 'tollbooth') {
    ctx.fillStyle = '#ffcc00';
    for (let i = 0; i < bw; i += 8) {
      const lit = Math.sin(Date.now() / 300 + i) > 0;
      ctx.fillStyle = lit ? '#ffcc00' : '#885500';
      ctx.fillRect(sx + i, by - 4, 6, 6);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TOLL', sx + bw / 2, by + bh / 2 + 3);
    ctx.textAlign = 'left';
  }
  
  if (col === hoverCol && selectedTool === 'demolish') {
    ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
    ctx.fillRect(sx, by - 12, bw, bh + 12);
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, by, bw, bh);
  }
}

function drawWorker(w) {
  const sx = w.x - camX;
  const gy = GROUND_Y();
  if (sx < -30 || sx > CW + 30) return;
  
  const frame = w.frame;
  
  ctx.fillStyle = '#ff9933';
  ctx.fillRect(sx - 4, gy - 20, 8, 10);
  
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(sx - 5, gy - 28, 10, 6);
  ctx.fillStyle = '#e6b800';
  ctx.fillRect(sx - 6, gy - 24, 12, 3);
  
  ctx.fillStyle = '#f4c090';
  ctx.fillRect(sx - 3, gy - 24, 6, 4);
  
  ctx.fillStyle = '#cc7733';
  if (frame === 0) {
    ctx.fillRect(sx + 5, gy - 19, 5, 3);
    ctx.fillRect(sx - 9, gy - 19, 4, 3);
  } else {
    ctx.fillRect(sx + 5, gy - 21, 5, 3);
    ctx.fillRect(sx - 9, gy - 21, 4, 3);
  }
  
  ctx.fillStyle = '#888';
  ctx.fillRect(sx + 9, gy - 22, 2, 10);
  ctx.fillStyle = '#555';
  ctx.fillRect(sx + 7, gy - 24, 6, 3);
  
  ctx.fillStyle = '#2255aa';
  if (frame === 0) {
    ctx.fillRect(sx - 4, gy - 10, 3, 10);
    ctx.fillRect(sx + 1, gy - 10, 3, 7);
  } else {
    ctx.fillRect(sx - 4, gy - 10, 3, 7);
    ctx.fillRect(sx + 1, gy - 10, 3, 10);
  }
}

function drawWalker(w) {
  const sx = w.x - camX;
  const gy = GROUND_Y();
  if (sx < -15 || sx > CW + 15) return;
  
  ctx.fillStyle = w.color;
  ctx.fillRect(sx - 3, gy - 16, 6, 8);
  ctx.fillRect(sx - 2, gy - 22, 5, 5);
  
  ctx.fillStyle = '#444';
  if (w.frame === 0) {
    ctx.fillRect(sx - 3, gy - 8, 3, 8);
    ctx.fillRect(sx, gy - 8, 3, 5);
  } else {
    ctx.fillRect(sx - 3, gy - 8, 3, 5);
    ctx.fillRect(sx, gy - 8, 3, 8);
  }
}

function drawCar(car) {
  const sx = car.x - camX;
  const gy = GROUND_Y();
  if (sx < -70 || sx > CW + 70) return;
  
  const d = car.dir;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(sx - 20, gy + 16, 40, 4);
  
  ctx.fillStyle = car.color;
  ctx.fillRect(sx - 20, gy + 3, 40, 12);
  
  ctx.fillStyle = '#222';
  ctx.fillRect(sx + (d > 0 ? -14 : -16), gy - 4, 30, 8);
  
  ctx.fillStyle = '#88ccff';
  ctx.fillRect(sx + (d > 0 ? -12 : -2), gy - 3, 12, 6);
  ctx.fillRect(sx + (d > 0 ? 2 : -14), gy - 3, 12, 6);
  
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(sx - 12, gy + 15, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + 12, gy + 15, 6, 0, Math.PI * 2);
  ctx.fill();
  
  if (timeOfDay > 19 || timeOfDay < 7) {
    ctx.fillStyle = 'rgba(255, 255, 180, 0.9)';
    const lx = d > 0 ? sx + 20 : sx - 24;
    ctx.fillRect(lx, gy + 4, 4, 4);
    ctx.fillRect(lx, gy + 9, 4, 4);
    
    ctx.fillStyle = 'rgba(255, 255, 180, 0.2)';
    ctx.beginPath();
    ctx.moveTo(lx + (d > 0 ? 4 : 0), gy + 6);
    ctx.lineTo(lx + d * 60, gy);
    ctx.lineTo(lx + d * 60, gy + 14);
    ctx.lineTo(lx + (d > 0 ? 4 : 0), gy + 11);
    ctx.fill();
  }
}

function drawHoverPreview() {
  if (selectedTool === 'none' || selectedTool === 'demolish' || hoverCol < 0) return;
  if (selectedTool === 'custom' || selectedTool === '_custom_pending') return;
  
  const def = BDEFS[selectedTool];
  if (!def) return;
  
  const sx = wx(hoverCol);
  const gy = GROUND_Y();
  const bw = def.w * TILE;
  const bh = Math.max(def.h * TILE, 20);
  
  const occupied = selectedTool !== 'road' && selectedTool !== 'tollbooth' &&
    Array.from({length: def.w}, (_, i) => grid[hoverCol + i]).some(Boolean);
  const canAfford = money >= (def.cost || 0);
  const ok = canAfford && !occupied;
  
  const preY = selectedTool === 'road' ? gy : gy - bh;
  const preH = selectedTool === 'road' ? 18 : bh;
  
  ctx.fillStyle = ok ? 'rgba(100, 255, 100, 0.25)' : 'rgba(255, 50, 50, 0.25)';
  ctx.fillRect(sx, preY, bw, preH);
  
  ctx.strokeStyle = ok ? '#4cff91' : '#ff4466';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(sx, preY, bw, preH);
  ctx.setLineDash([]);
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.fillStyle = `rgba(0, 212, 255, ${p.life})`;
    ctx.fillRect(p.x - camX, p.y, 3, 3);
  });
}

function draw() {
  ctx.clearRect(0, 0, CW, CH);
  
  const grad = ctx.createLinearGradient(0, 0, 0, CH * 0.7);
  grad.addColorStop(0, skyColor());
  grad.addColorStop(1, '#c8e8f8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);
  
  if (timeOfDay > 20 || timeOfDay < 6) {
    const alpha = timeOfDay > 20 ? (timeOfDay - 20) / 3 : Math.min(1, (6 - timeOfDay) / 3);
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * (0.4 + Math.random() * 0.6)})`;
      const x = (i * 137 + camX * 0.01) % CW;
      const y = (i * 73) % (CH * 0.6);
      ctx.fillRect(x, y, 2, 2);
    }
  }
  
  const t = timeOfDay;
  if (t >= 5 && t <= 19) {
    const sunX = ((t - 5) / 14) * CW;
    const sunY = CH * 0.5 - Math.sin((t - 5) / 14 * Math.PI) * CH * 0.45;
    ctx.fillStyle = '#fff176';
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#ffaa00';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    const mt = t >= 19 ? (t - 19) / 11 : (t + 5) / 11;
    const mx = mt * CW;
    const my = CH * 0.5 - Math.sin(mt * Math.PI) * CH * 0.45;
    ctx.fillStyle = '#ddeeff';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#aaccff';
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  
  clouds.forEach(cl => drawCloud(cl.x - camX * 0.3, cl.y, cl.s));
  
  ctx.fillStyle = '#3a6a2a';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y());
  for (let x = 0; x <= CW; x += 5) {
    const hx = x + camX * 0.15;
    const y = GROUND_Y() - 25 + 
      Math.sin(hx * 0.008) * 45 + 
      Math.sin(hx * 0.02) * 20 + 
      Math.sin(hx * 0.05) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CW, CH);
  ctx.lineTo(0, CH);
  ctx.closePath();
  ctx.fill();
  
  drawGround();
  
  const gy = GROUND_Y();
  for (const col of Object.keys(roadGrid)) {
    const c = parseInt(col);
    const sx = wx(c);
    if (sx + TILE < 0 || sx > CW) continue;
    
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(sx, gy, TILE, 40);
    ctx.fillStyle = '#555';
    ctx.fillRect(sx, gy + 19, TILE, 2);
  }
  
  for (const col of Object.keys(tollGrid)) {
    const c = parseInt(col);
    const sx = wx(c);
    if (sx + TILE < 0 || sx > CW) continue;
    
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(sx + 3, gy - 32, TILE - 6, 32);
    ctx.fillStyle = '#cc5500';
    ctx.fillRect(sx, gy - 34, TILE, 4);
    
    for (let i = 0; i < 3; i++) {
      const lit = Math.sin(Date.now() / 250 + i) > 0;
      ctx.fillStyle = lit ? '#ffcc00' : '#885500';
      ctx.fillRect(sx + 5 + i * 9, gy - 10, 7, 7);
    }
  }
  
  for (const [col, b] of Object.entries(grid)) {
    drawBuildingSide(parseInt(col), b);
  }
  
  drawHoverPreview();
  walkers.forEach(drawWalker);
  workers.forEach(drawWorker);
  cars.forEach(drawCar);
  drawParticles();
}

// ═══════════════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════════════
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;
  
  if (speed > 0) {
    clouds.forEach(cl => {
      cl.x += cl.sp * speed;
      if (cl.x - camX * 0.3 > CW + 150) cl.x = camX * 0.3 - 150;
    });
    
    walkers.forEach(w => {
      w.x += w.dir * (speed * 0.4 + 0.2);
      w.ft += dt * speed * 3;
      if (w.ft > 0.3) {
        w.frame ^= 1;
        w.ft = 0;
      }
      if (w.x < camX - 80) w.x = camX + CW + 80;
      if (w.x > camX + CW + 80) w.x = camX - 80;
    });
    
    workers.forEach((w, i) => {
      w.ft += dt * speed * 4;
      if (w.ft > 0.25) {
        w.frame ^= 1;
        w.ft = 0;
      }
      w.x += Math.sin(Date.now() / 500 + i) * 0.5;
    });
    
    cars.forEach((car, i) => {
      car.x += car.dir * (speed * 2.5 + 1.5);
      checkToll(car);
      if (car.dir > 0 && car.x > COLS * TILE + 80) cars.splice(i, 1);
      if (car.dir < 0 && car.x < -80) cars.splice(i, 1);
    });
    
    particles.forEach((p, i) => {
      p.x += p.vx * speed;
      p.y += p.vy * speed;
      p.vy += 0.3;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    });
    
    for (const b of Object.values(grid)) {
      if (b.constructing && b.conProg < 1) {
        b.conProg += dt * speed * 0.09;
        if (b.conProg >= 1) {
          b.conProg = 1;
          b.constructing = false;
          workers = workers.filter(w => w.col !== b._col);
          const def = BDEFS[b.type] || b.customDef;
          showPopup('✅ ' + (def?.label || 'BUILDING') + ' COMPLETE!');
          createParticles(b._col * TILE - camX + (def.w * TILE / 2), GROUND_Y() - (def.h * TILE / 2), 15);
        }
      }
    }
  }
  
  dayTick(dt);
  updateHUD();
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ═══════════════════════════════════════════════════════════
// VIEW TOGGLE
// ═══════════════════════════════════════════════════════════
function setView(v) {
  viewMode = v;
  document.getElementById('viewSide').classList.toggle('active', v === 'side');
  document.getElementById('viewTop').classList.toggle('active', v === 'top');
}

// ═══════════════════════════════════════════════════════════
// TOOL SELECTION
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.tbtn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    
    if (btn.classList.contains('locked')) {
      const def = BDEFS[tool];
      showPopup('🔒 NEED ' + def.unlock + ' POPULATION TO UNLOCK!');
      return;
    }
    
    if (tool === 'custom') {
      openBuilder();
      return;
    }
    
    selectedTool = tool;
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const cursor = tool === 'demolish' ? 'not-allowed' : 'crosshair';
    document.getElementById('canvasWrap').style.cursor = cursor;
  });
});

// Speed controls
document.querySelectorAll('.sbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    speed = parseInt(btn.dataset.speed);
    document.querySelectorAll('.sbtn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Stats toggle
document.getElementById('statsToggle').addEventListener('click', () => {
  document.getElementById('statsPanel').classList.toggle('open');
});

// ═══════════════════════════════════════════════════════════
// MOUSE INTERACTION
// ═══════════════════════════════════════════════════════════
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left + camX;
  hoverCol = Math.floor(mx / TILE);
});

canvas.addEventListener('mouseleave', () => {
  hoverCol = -1;
});

canvas.addEventListener('click', e => {
  if (selectedTool === 'none') return;
  const r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left + camX;
  const col = Math.floor(mx / TILE);
  placeAt(col);
});

let dragging = false;
let dragStartX = 0;
let dragCamX = 0;

canvas.addEventListener('mousedown', e => {
  if (selectedTool !== 'none') return;
  dragging = true;
  dragStartX = e.clientX;
  dragCamX = camX;
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', () => {
  dragging = false;
  canvas.style.cursor = selectedTool === 'demolish' ? 'not-allowed' : 
    (selectedTool === 'none' ? 'grab' : 'crosshair');
});

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  camX = Math.max(0, Math.min(COLS * TILE - CW, dragCamX - (e.clientX - dragStartX)));
});

canvas.addEventListener('wheel', e => {
  camX = Math.max(0, Math.min(COLS * TILE - CW, camX + e.deltaY * 0.8));
  e.preventDefault();
}, {passive: false});

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') camX = Math.min(COLS * TILE - CW, camX + 60);
  if (e.key === 'ArrowLeft') camX = Math.max(0, camX - 60);
});

// ═══════════════════════════════════════════════════════════
// PLACEMENT
// ═══════════════════════════════════════════════════════════
function placeAt(col) {
  if (selectedTool === 'demolish') {
    if (grid[col]) {
      const def = BDEFS[grid[col].type] || grid[col].customDef;
      const refund = Math.floor((def?.cost || 0) * 0.5);
      const bw = def?.w || 1;
      for (let i = 0; i < bw; i++) delete grid[col + i];
      money += refund;
      showPopup('💥 DEMOLISHED! +$' + refund + ' refund');
      updateHUD();
      createParticles(col * TILE - camX, GROUND_Y(), 15);
    } else if (tollGrid[col]) {
      delete tollGrid[col];
      money += 400;
      showPopup('TOLL REMOVED +$400');
      updateHUD();
    } else if (roadGrid[col]) {
      delete roadGrid[col];
      money += 25;
      showPopup('ROAD REMOVED +$25');
      updateHUD();
    }
    return;
  }
  
  if (selectedTool === '_custom_pending') {
    if (!customBuildDef) return;
    if (money < customBuildDef.cost) {
      showPopup('💸 NOT ENOUGH MONEY!');
      return;
    }
    
    for (let i = 0; i < customBuildDef.w; i++) {
      if (grid[col + i]) {
        showPopup('❌ NOT ENOUGH SPACE!');
        return;
      }
    }
    
    const winMap = {};
    const bObj = {
      type: 'custom',
      customDef: customBuildDef,
      cells: customBuildCells,
      constructing: true,
      conProg: 0,
      _col: col,
      winMap
    };
    
    for (let i = 0; i < customBuildDef.w; i++) {
      grid[col + i] = bObj;
    }
    
    money -= customBuildDef.cost;
    spawnWorkers(col, customBuildDef);
    showPopup('🧱 BUILDING ' + customBuildDef.label + '!');
    updateHUD();
    selectedTool = 'none';
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
    return;
  }
  
  const cost = BDEFS[selectedTool]?.cost || 0;
  
  if (money < cost) {
    showPopup('💸 NOT ENOUGH MONEY! Need $' + cost);
    return;
  }
  
  if (selectedTool === 'road') {
    if (roadGrid[col]) return;
    roadGrid[col] = true;
    money -= cost;
    showPopup('🛣️ ROAD BUILT -$' + cost);
    updateHUD();
    if (cars.length < 10 && Math.random() < 0.6) spawnCar();
    return;
  }
  
  if (selectedTool === 'tollbooth') {
    if (tollGrid[col]) {
      showPopup('❌ TOLL ALREADY HERE!');
      return;
    }
    tollGrid[col] = true;
    money -= cost;
    showPopup('🚧 TOLL BOOTH BUILT!');
    updateHUD();
    return;
  }
  
  const def = BDEFS[selectedTool];
  if (!def) return;
  
  for (let i = 0; i < def.w; i++) {
    if (grid[col + i]) {
      showPopup('❌ NOT ENOUGH SPACE!');
      return;
    }
  }
  
  if (col < 0 || col + def.w > COLS) {
    showPopup('❌ OUT OF BOUNDS!');
    return;
  }
  
  const winMap = {};
  const wCols = Math.max(1, Math.floor(def.w * TILE / 14) - 1);
  const wRows = Math.max(1, Math.floor(def.h * TILE / 12) - 1);
  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      winMap[r * 20 + c] = Math.random() < 0.7;
    }
  }
  
  const bObj = {
    type: selectedTool,
    winMap,
    constructing: true,
    conProg: 0,
    _col: col
  };
  
  for (let i = 0; i < def.w; i++) {
    grid[col + i] = bObj;
  }
  
  money -= cost;
  spawnWorkers(col, def);
  showPopup('🏗️ BUILDING ' + def.label + '...');
  createParticles(col * TILE - camX, GROUND_Y(), 10);
  updateHUD();
  
  if (population > walkers.length * 2 && walkers.length < 50) spawnWalker();
}

// Popup
let popupTimeout = null;
function showPopup(msg) {
  const el = document.getElementById('popup');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════════
// LEGO BUILDER
// ═══════════════════════════════════════════════════════════
const LEGO_COLORS = [
  '#ff4444', '#4444ff', '#44ff44', '#ffff44', '#ff8844', '#ff44ff',
  '#44ffff', '#8844ff', '#ff4488', '#88ff44', '#4488ff', '#ffaa44',
  '#5577aa', '#aa5577', '#77aa55', '#aa7755', '#7755aa', '#55aa77',
  '#666666', '#999999', '#333333', '#cccccc'
];

let bSelColor = LEGO_COLORS[0];
let bCells = [];
const bCanvas = document.getElementById('bCanvas');
const bCtx = bCanvas.getContext('2d');
let customBuildDef = null;
let customBuildCells = [];

function openBuilder() {
  bCells = [];
  buildPalette();
  updateBuilderPreview();
  renderBuilderGrid();
  document.getElementById('builderModal').classList.add('open');
}

function closeBuilder() {
  document.getElementById('builderModal').classList.remove('open');
}

function buildPalette() {
  const p = document.getElementById('bPalette');
  p.innerHTML = '';
  LEGO_COLORS.forEach(c => {
    const d = document.createElement('div');
    d.className = 'bpal' + (c === bSelColor ? ' active' : '');
    d.style.background = c;
    d.onclick = () => {
      bSelColor = c;
      buildPalette();
    };
    p.appendChild(d);
  });
}

function renderBuilderGrid() {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  const grid = document.getElementById('bGrid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${width}, 32px)`;
  
  for (let y = floors - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const cell = document.createElement('div');
      cell.className = 'bcell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      const existing = bCells.find(c => c.cx === x && c.cy === y);
      if (existing) {
        cell.classList.add('filled');
        cell.style.setProperty('--bcolor', existing.color);
        cell.style.background = existing.color;
        if (existing.type === 'window') cell.textContent = '🪟';
        if (existing.type === 'door') cell.textContent = '🚪';
      }
      
      cell.addEventListener('mousedown', e => {
        e.preventDefault();
        if (e.button === 0) {
          paintCell(parseInt(cell.dataset.x), parseInt(cell.dataset.y));
        } else if (e.button === 2) {
          eraseCell(parseInt(cell.dataset.x), parseInt(cell.dataset.y));
        }
      });
      
      cell.addEventListener('mouseenter', e => {
        if (e.buttons === 1) {
          paintCell(parseInt(cell.dataset.x), parseInt(cell.dataset.y));
        } else if (e.buttons === 2) {
          eraseCell(parseInt(cell.dataset.x), parseInt(cell.dataset.y));
        }
      });
      
      cell.addEventListener('contextmenu', e => e.preventDefault());
      grid.appendChild(cell);
    }
  }
  
  renderBuilderCanvas();
}

function paintCell(x, y) {
  const existing = bCells.findIndex(c => c.cx === x && c.cy === y);
  if (existing >= 0) {
    bCells[existing].color = bSelColor;
  } else {
    bCells.push({cx: x, cy: y, color: bSelColor, type: 'block'});
  }
  renderBuilderGrid();
  renderBuilderCanvas();
}

function eraseCell(x, y) {
  const idx = bCells.findIndex(c => c.cx === x && c.cy === y);
  if (idx >= 0) {
    bCells.splice(idx, 1);
    renderBuilderGrid();
    renderBuilderCanvas();
  }
}

function renderBuilderCanvas() {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  
  bCtx.fillStyle = '#0a0a15';
  bCtx.fillRect(0, 0, 240, 240);
  
  const cs = Math.min(200 / width, 200 / floors);
  const ox = (240 - width * cs) / 2;
  const oy = (240 - floors * cs) / 2;
  
  for (let y = 0; y < floors; y++) {
    for (let x = 0; x < width; x++) {
      bCtx.fillStyle = 'rgba(100, 100, 100, 0.1)';
      bCtx.fillRect(ox + x * cs, oy + (floors - 1 - y) * cs, cs - 1, cs - 1);
      bCtx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
      bCtx.lineWidth = 1;
      bCtx.strokeRect(ox + x * cs, oy + (floors - 1 - y) * cs, cs - 1, cs - 1);
    }
  }
  
  bCells.forEach(cell => {
    const cx = ox + cell.cx * cs;
    const cy = oy + (floors - 1 - cell.cy) * cs;
    
    bCtx.fillStyle = cell.color;
    bCtx.fillRect(cx + 1, cy + 1, cs - 3, cs - 3);
    
    bCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    bCtx.fillRect(cx + 1, cy + cs - 5, cs - 3, 3);
    bCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    bCtx.fillRect(cx + 1, cy + 1, cs - 3, 3);
    
    bCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    bCtx.beginPath();
    bCtx.arc(cx + cs / 2, cy + cs / 3, cs / 5, 0, Math.PI * 2);
    bCtx.fill();
  });
  
  updateBuilderPreview();
}

function updateBuilderPreview() {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  const cost = 200 + floors * 100 + width * 60 + bCells.length * 8;
  const pop = Math.floor(floors * width * 1.5);
  const inc = Math.floor(floors * width * 1.2);
  const pwr = Math.ceil(floors / 2);
  const hap = Math.floor(bCells.length / 10);
  
  document.getElementById('bCost').textContent = '$' + cost;
  document.getElementById('bPop').textContent = pop;
  document.getElementById('bInc').textContent = '+$' + inc + '/day';
  document.getElementById('bPwr').textContent = pwr;
  document.getElementById('bHap').textContent = '+' + hap;
  document.getElementById('bBlocks').textContent = bCells.length;
}

function clearBuilder() {
  bCells = [];
  renderBuilderGrid();
}

function randomizeBuilder() {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  bCells = [];
  
  for (let y = 0; y < floors; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.random() < 0.75) {
        bCells.push({
          cx: x,
          cy: y,
          color: LEGO_COLORS[Math.floor(Math.random() * LEGO_COLORS.length)],
          type: 'block'
        });
      }
    }
  }
  
  renderBuilderGrid();
}

function applyTemplate(template) {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  bCells = [];
  
  if (template === 'modern') {
    const colors = ['#5577aa', '#6688bb', '#7799cc'];
    for (let y = 0; y < floors; y++) {
      for (let x = 0; x < width; x++) {
        bCells.push({cx: x, cy: y, color: colors[y % colors.length], type: 'block'});
      }
    }
  } else if (template === 'classic') {
    for (let y = 0; y < floors; y++) {
      for (let x = 0; x < width; x++) {
        bCells.push({cx: x, cy: y, color: '#c87941', type: 'block'});
      }
    }
  } else if (template === 'industrial') {
    for (let y = 0; y < floors; y++) {
      for (let x = 0; x < width; x++) {
        bCells.push({cx: x, cy: y, color: '#666666', type: 'block'});
      }
    }
  } else if (template === 'futuristic') {
    const colors = ['#44ffff', '#4488ff', '#8844ff'];
    for (let y = 0; y < floors; y++) {
      const w = Math.max(2, width - Math.floor(y / 3));
      const offset = Math.floor((width - w) / 2);
      for (let x = offset; x < offset + w; x++) {
        bCells.push({cx: x, cy: y, color: colors[Math.floor(Math.random() * colors.length)], type: 'block'});
      }
    }
  }
  
  renderBuilderGrid();
}

function confirmCustomBuild() {
  const floors = parseInt(document.getElementById('bFloors').value) || 6;
  const width = parseInt(document.getElementById('bWidth').value) || 4;
  const name = document.getElementById('bName').value || 'MY LEGO TOWER';
  const cost = 200 + floors * 100 + width * 60 + bCells.length * 8;
  const pop = Math.floor(floors * width * 1.5);
  const inc = Math.floor(floors * width * 1.2);
  const pwr = Math.ceil(floors / 2);
  const hap = Math.floor(bCells.length / 10);
  
  if (bCells.length === 0) {
    showPopup('❌ ADD SOME BLOCKS FIRST!');
    return;
  }
  
  if (money < cost) {
    showPopup('💸 NOT ENOUGH MONEY! Need $' + cost);
    return;
  }
  
  customBuildDef = {
    w: width,
    h: floors,
    color: bCells[0]?.color || LEGO_COLORS[0],
    roof: '#334466',
    pop,
    income: inc,
    hap,
    pwr,
    upkeep: Math.ceil(floors / 2),
    cost,
    label: name
  };
  
  customBuildCells = [...bCells];
  closeBuilder();
  selectedTool = '_custom_pending';
  
  document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('active'));
  showPopup('🧱 CLICK TO PLACE: ' + name);
}

['bFloors', 'bWidth'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => {
    bCells = [];
    renderBuilderGrid();
  });
});

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════
for (let i = 0; i < 12; i++) {
  roadGrid[i] = true;
}

for (let i = 0; i < 4; i++) {
  spawnWalker();
}

updateHUD();