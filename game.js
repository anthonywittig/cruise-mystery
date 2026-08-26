/* ============================================================
   ALIENS ON DECK!  —  defend the S.S. Starlight
   A retro top-down 2D arcade game. Vanilla JS + Canvas.
   ============================================================ */
(() => {
"use strict";

// ---------------------------------------------------------- setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const VIEW_W = 480;             // width of each player's viewport
const VIEW_H = canvas.height;   // 320
const SPLIT_GAP = 4;            // divider between the two views
const CANVAS_W = canvas.width;  // 964 = two viewports + divider
const TILE = 16;

// world grid
const GRID_W = 44;
const GRID_H = 96;
const WORLD_W = GRID_W * TILE;
const WORLD_H = GRID_H * TILE;
const CX = 22; // ship center column

// tile ids
const T_WATER = 0, T_DECK = 1, T_POOL = 2, T_CARPET = 3, T_WALL = 4,
      T_TABLE = 5, T_RAIL = 6, T_ST_PLATES = 7, T_ST_CARDS = 8,
      T_ST_CHARMS = 9, T_SHUFFLE = 10, T_POOL_EDGE = 11;

const SOLID = new Set([T_WATER, T_POOL, T_WALL, T_TABLE, T_RAIL,
  T_ST_PLATES, T_ST_CARDS, T_ST_CHARMS, T_POOL_EDGE]);

// ---------------------------------------------------------- audio
let audioCtx = null;
let muted = false;
function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioCtx = null; }
  }
}
function beep(freq, dur, type, vol, slide) {
  if (muted || !audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || "square";
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}
const sfx = {
  throwCard:  () => beep(700, 0.07, "square", 0.05, -300),
  throwPlate: () => beep(220, 0.12, "triangle", 0.09, -80),
  throwCharm: () => beep(1100, 0.08, "square", 0.045, 300),
  hit:        () => beep(300, 0.06, "sawtooth", 0.06, -150),
  alienDie:   () => beep(160, 0.25, "sawtooth", 0.09, -120),
  hurt:       () => beep(110, 0.25, "square", 0.1, -60),
  pickup:     () => beep(880, 0.09, "square", 0.06, 400),
  refill:     () => beep(520, 0.05, "square", 0.04, 200),
  wave:       () => { beep(330, 0.15, "square", 0.08); setTimeout(() => beep(440, 0.15, "square", 0.08), 160); setTimeout(() => beep(550, 0.25, "square", 0.08), 320); },
  portal:     () => beep(90, 0.4, "sawtooth", 0.07, 200),
  abduct:     () => { beep(200, 0.5, "sawtooth", 0.08, 700); setTimeout(() => beep(400, 0.3, "sine", 0.06, 500), 150); },
  rescue:     () => { beep(900, 0.12, "square", 0.06, -300); setTimeout(() => beep(600, 0.15, "square", 0.06, -200), 120); },
  gameover:   () => { beep(440, 0.3, "square", 0.09, -200); setTimeout(() => beep(220, 0.5, "square", 0.09, -120), 300); },
  victory:    () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, "square", 0.08), i * 180)); },
};

// ---------------------------------------------------------- sprites
function sheet(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== ".") { g.fillStyle = pal[ch] || "#f0f"; g.fillRect(x, y, 1, 1); }
    }
  return c;
}
function flipH(img) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.translate(img.width, 0); g.scale(-1, 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  return c;
}

// --- player (tourist in a hawaiian shirt), 10x13, Zelda-ish 3/4 view
const PAL_PLAYER = {
  k: "#7a4a21", // hair
  f: "#f2c396", // skin
  w: "#ffffff", // eye white
  e: "#222233", // pupil
  h: "#e8484d", // shirt red
  s: "#ffd23e", // shirt flower
  p: "#3b5c8f", // shorts
  b: "#6b4a2b", // sandals
};
const P_DOWN_0 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kffffffk.",
  ".kfeffefk.",
  "..ffffff..",
  "...ffff...",
  ".hhhhhhhh.",
  "hhshhhhshh",
  "fhhhhhhhhf",
  ".hhhhhhhh.",
  "..pppppp..",
  "..pp..pp..",
  "..bb..bb..",
], PAL_PLAYER);
const P_DOWN_1 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kffffffk.",
  ".kfeffefk.",
  "..ffffff..",
  "...ffff...",
  ".hhhhhhhh.",
  "hhshhhhshh",
  "fhhhhhhhhf",
  ".hhhhhhhh.",
  "..pppppp..",
  "..bb..pp..",
  "......bb..",
], PAL_PLAYER);
const P_UP_0 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kkkkkkkk.",
  ".kkkkkkkk.",
  "..kkkkkk..",
  "...ffff...",
  ".hhhhhhhh.",
  "hhhhshhshh",
  "fhhhhhhhhf",
  ".hhhhhhhh.",
  "..pppppp..",
  "..pp..pp..",
  "..bb..bb..",
], PAL_PLAYER);
const P_UP_1 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kkkkkkkk.",
  ".kkkkkkkk.",
  "..kkkkkk..",
  "...ffff...",
  ".hhhhhhhh.",
  "hhhhshhshh",
  "fhhhhhhhhf",
  ".hhhhhhhh.",
  "..pppppp..",
  "..pp..bb..",
  "..bb......",
], PAL_PLAYER);
const P_SIDE_0 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kkffffk..",
  ".kkfeffk..",
  "..kffff...",
  "...ffff...",
  "..hhhhhh..",
  ".hhshhhhh.",
  ".hhhhhhhf.",
  "..hhhhhh..",
  "...pppp...",
  "...pppp...",
  "...bbbb...",
], PAL_PLAYER);
const P_SIDE_1 = sheet([
  "..kkkkkk..",
  ".kkkkkkkk.",
  ".kkffffk..",
  ".kkfeffk..",
  "..kffff...",
  "...ffff...",
  "..hhhhhh..",
  ".hhshhhhh.",
  ".hhhhhhhf.",
  "..hhhhhh..",
  "...pppp...",
  "..pp..pp..",
  "..bb..bb..",
], PAL_PLAYER);
const PLAYER_SPR = {
  down: [P_DOWN_0, P_DOWN_1],
  up: [P_UP_0, P_UP_1],
  right: [P_SIDE_0, P_SIDE_1],
  left: [flipH(P_SIDE_0), flipH(P_SIDE_1)],
};

// player 2: same tourist, blue hawaiian shirt & maroon shorts
function swapColors(img, from, to) {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i] === from[0] && d.data[i + 1] === from[1] && d.data[i + 2] === from[2]) {
      d.data[i] = to[0]; d.data[i + 1] = to[1]; d.data[i + 2] = to[2];
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}
const PLAYER_SPR2 = {};
for (const dir in PLAYER_SPR)
  PLAYER_SPR2[dir] = PLAYER_SPR[dir].map(f =>
    swapColors(swapColors(f, [232, 72, 77], [59, 143, 232]),  // shirt red -> blue
               [59, 92, 143], [143, 59, 92]));                // shorts navy -> maroon

// --- passengers: recolor player sheet
function recolor(rows, pal) { return sheet(rows, pal); }
const PASSENGER_SHIRTS = ["#3fa14d", "#8a4fd0", "#e88f2a", "#2ab5c9", "#d94f9e"];
const PASSENGER_SPRS = PASSENGER_SHIRTS.map(col => {
  const pal = Object.assign({}, PAL_PLAYER, { h: col, s: "#ffffff", k: ["#3a2a18","#888888","#c9a227","#222222","#a05a2c"][Math.floor(Math.random()*5)] });
  return {
    down: [recolor([
      "..kkkkkk..",".kkkkkkkk.",".kffffffk.",".kfeffefk.","..ffffff..","...ffff...",
      ".hhhhhhhh.","hhshhhhshh","fhhhhhhhhf",".hhhhhhhh.","..pppppp..","..pp..pp..","..bb..bb..",
    ], pal), recolor([
      "..kkkkkk..",".kkkkkkkk.",".kffffffk.",".kfeffefk.","..ffffff..","...ffff...",
      ".hhhhhhhh.","hhshhhhshh","fhhhhhhhhf",".hhhhhhhh.","..pppppp..","..bb..pp..","......bb..",
    ], pal)],
  };
});

// --- aliens: blob body and walker body, palette-swapped per type
function makeBlob(body, dark, glow) {
  const pal = { b: body, d: dark, e: "#ffffff", p: "#111122", g: glow, m: "#111122" };
  const f0 = sheet([
    "...bbbb...",
    "..bbbbbb..",
    ".bbebbebb.",
    ".bbpbbpbb.",
    "bbbbbbbbbb",
    "bbmmmmmmbb",
    ".bdbbbbdb.",
    ".dbdbbdbd.",
  ], pal);
  const f1 = sheet([
    "..bbbbbb..",
    ".bbbbbbbb.",
    ".bbebbebb.",
    ".bbpbbpbb.",
    "bbbbbbbbbb",
    "bbmmmmmmbb",
    "bdbbbbbbdb",
    "d.dbdbdb.d",
  ], pal);
  return [f0, f1];
}
function makeWalker(body, dark) {
  const pal = { b: body, d: dark, e: "#ffffff", p: "#111122" };
  const f0 = sheet([
    "..b....b..",
    "..db..bd..",
    "..bbbbbb..",
    ".bbebbebb.",
    ".bbpbbpbb.",
    ".bbbbbbbb.",
    "..dbbbbd..",
    "..b.bb.b..",
    ".bd.bb.db.",
    "bd..dd..db",
  ], pal);
  const f1 = sheet([
    "..b....b..",
    "..db..bd..",
    "..bbbbbb..",
    ".bbebbebb.",
    ".bbpbbpbb.",
    ".bbbbbbbb.",
    "..dbbbbd..",
    "..bb..bb..",
    "..db..bd..",
    "..bd..db..",
  ], pal);
  return [f0, f1];
}
const ALIEN_SPRS = {
  drifter:  makeBlob("#4fd05a", "#2c8f38", "#a5ff9e"),
  sprinter: makeWalker("#ff6ec7", "#c02f8f"),
  bruiser:  makeBlob("#9a5fe0", "#5c2f9e", "#d8b5ff"),
  spitter:  makeWalker("#2ad0b5", "#128a76"),
};
// boss = big scaled bruiser blob with crown
const BOSS_SPR = (() => {
  const base = makeBlob("#b04fd0", "#6e2a8a", "#f0b5ff")[0];
  const c = document.createElement("canvas");
  c.width = 40; c.height = 34;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(base, 0, 2, 40, 32);
  g.fillStyle = "#ffd23e"; // little crown, because she's the Broodmother
  g.fillRect(14, 0, 2, 4); g.fillRect(19, 0, 2, 4); g.fillRect(24, 0, 2, 4);
  g.fillRect(14, 3, 12, 2);
  return c;
})();
const BOSS_SPR2 = (() => {
  const base = makeBlob("#b04fd0", "#6e2a8a", "#f0b5ff")[1];
  const c = document.createElement("canvas");
  c.width = 40; c.height = 34;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(base, 0, 2, 40, 32);
  g.fillStyle = "#ffd23e";
  g.fillRect(14, 0, 2, 4); g.fillRect(19, 0, 2, 4); g.fillRect(24, 0, 2, 4);
  g.fillRect(14, 3, 12, 2);
  return c;
})();

// --- projectiles & items
const SPR_CARD = sheet([
  "wwwwwww",
  "wrwrwrw",
  "wwwwwww",
  "wrwrwrw",
  "wwwwwww",
], { w: "#f5f2e0", r: "#c0392b" });
const SPR_PLATE = sheet([
  "..wwww..",
  ".wwccww.",
  "wwccccww",
  "wwccccww",
  ".wwccww.",
  "..wwww..",
], { w: "#e8e8f0", c: "#b8c4d8" });
const SPR_CHARM = sheet([
  "..y..",
  ".yyy.",
  "yywyy",
  ".yyy.",
  "..y..",
], { y: "#ffd23e", w: "#ffffff" });
const SPR_GOO = sheet([
  ".gg.",
  "gggg",
  "gggg",
  ".gg.",
], { g: "#8aff3e" });
const SPR_SODA = sheet([
  ".rr.",
  "wwww",
  "wrrw",
  "wrrw",
  "wwww",
], { r: "#e8484d", w: "#e8e8f0" });
const SPR_AMMO = sheet([
  "oooooo",
  "oyyyyo",
  "oyooyo",
  "oyyyyo",
  "oooooo",
], { o: "#8a5a2a", y: "#ffd23e" });

// ---------------------------------------------------------- map
const map = new Uint8Array(GRID_W * GRID_H);
const stations = []; // {type, x, y (px center), label}
function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return T_WATER;
  return map[ty * GRID_W + tx];
}
function setTile(tx, ty, t) {
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return;
  map[ty * GRID_W + tx] = t;
}
function isSolidTile(tx, ty) { return SOLID.has(tileAt(tx, ty)); }

function hullHalf(y) {
  // half width of the hull at row y (ship points up / bow at top)
  if (y < 4 || y > 92) return -1;
  if (y < 24) {
    const t = (y - 4) / 20;
    return Math.max(2, Math.round(16 * Math.sqrt(t)));
  }
  if (y > 86) {
    const t = (y - 86) / 6;
    return Math.round(16 - 4 * t * t);
  }
  return 16;
}

function buildMap() {
  map.fill(T_WATER);
  // hull + deck
  for (let y = 0; y < GRID_H; y++) {
    const h = hullHalf(y);
    if (h < 0) continue;
    for (let x = CX - h; x <= CX + h; x++) setTile(x, y, T_DECK);
  }
  // railings: deck cells that border water
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++) {
      if (tileAt(x, y) !== T_DECK) continue;
      if (tileAt(x - 1, y) === T_WATER || tileAt(x + 1, y) === T_WATER ||
          tileAt(x, y - 1) === T_WATER || tileAt(x, y + 1) === T_WATER)
        setTile(x, y, T_RAIL);
    }

  // shuffleboard court on the bow deck
  for (let y = 14; y <= 20; y++)
    for (let x = CX - 2; x <= CX + 2; x++) setTile(x, y, T_SHUFFLE);

  // pool (solid water tile with edge)
  for (let y = 26; y <= 35; y++)
    for (let x = CX - 6; x <= CX + 6; x++) {
      const edge = (y === 26 || y === 35 || x === CX - 6 || x === CX + 6);
      setTile(x, y, edge ? T_POOL_EDGE : T_POOL);
    }

  // superstructure y 42..87, walls with door gaps
  const SX = 11; // half-width of superstructure
  const roomTop = 42, roomBot = 87;
  for (let y = roomTop; y <= roomBot; y++)
    for (let x = CX - SX; x <= CX + SX; x++) {
      const isWall = (y === roomTop || y === roomBot || x === CX - SX || x === CX + SX);
      setTile(x, y, isWall ? T_WALL : T_CARPET);
    }
  // interior divider walls
  for (let x = CX - SX; x <= CX + SX; x++) { setTile(x, 57, T_WALL); setTile(x, 71, T_WALL); }
  // doors: top wall center, side doors on each room, dividers
  const door = (x, y, w, horiz) => {
    for (let i = 0; i < w; i++) horiz ? setTile(x + i, y, T_CARPET) : setTile(x, y + i, T_CARPET);
  };
  door(CX - 2, roomTop, 4, true);      // main entrance from pool deck
  door(CX - 2, 57, 4, true);           // buffet -> bingo
  door(CX - 2, 71, 4, true);           // bingo -> jewelry
  door(CX - 2, roomBot, 4, true);      // jewelry -> stern deck
  door(CX - SX, 48, 3, false);         // buffet side doors to promenade
  door(CX + SX, 48, 3, false);
  door(CX - SX, 62, 3, false);         // bingo side doors
  door(CX + SX, 62, 3, false);
  door(CX - SX, 76, 3, false);         // jewelry side doors
  door(CX + SX, 76, 3, false);

  // BUFFET (y 43..56): long buffet counter + plate station
  for (let x = CX - 8; x <= CX - 4; x++) setTile(x, 46, T_TABLE);
  for (let x = CX + 4; x <= CX + 8; x++) setTile(x, 46, T_TABLE);
  for (let x = CX - 1; x <= CX + 1; x++) setTile(x, 46, T_ST_PLATES);
  stations.push({ type: "plates", x: CX * TILE + 8, y: 46 * TILE + 8, label: "BUFFET" });
  // dining tables
  [[CX - 7, 51], [CX + 5, 51], [CX - 7, 54], [CX + 5, 54], [CX - 1, 52]].forEach(([x, y]) => {
    setTile(x, y, T_TABLE); setTile(x + 1, y, T_TABLE);
  });

  // BINGO HALL (y 58..70): caller desk + card station
  for (let x = CX - 1; x <= CX + 1; x++) setTile(x, 60, T_ST_CARDS);
  stations.push({ type: "cards", x: CX * TILE + 8, y: 60 * TILE + 8, label: "BINGO" });
  [[CX - 8, 63], [CX - 3, 63], [CX + 2, 63], [CX + 6, 63],
   [CX - 8, 67], [CX - 3, 67], [CX + 2, 67], [CX + 6, 67]].forEach(([x, y]) => {
    setTile(x, y, T_TABLE); setTile(x + 1, y, T_TABLE);
  });

  // JEWELRY SHOP (y 72..87): display cases + charm station
  for (let x = CX - 1; x <= CX + 1; x++) setTile(x, 74, T_ST_CHARMS);
  stations.push({ type: "charms", x: CX * TILE + 8, y: 74 * TILE + 8, label: "SHOP" });
  [[CX - 8, 78], [CX + 6, 78], [CX - 8, 82], [CX + 6, 82]].forEach(([x, y]) => {
    setTile(x, y, T_TABLE); setTile(x + 1, y, T_TABLE); setTile(x + 2, y, T_TABLE);
  });

  // lounge chairs by the pool
  [[CX - 12, 28], [CX - 12, 31], [CX + 11, 28], [CX + 11, 31]].forEach(([x, y]) => setTile(x, y, T_TABLE));
}
buildMap();

function randomWalkableTile(minDistFromPlayer) {
  for (let tries = 0; tries < 400; tries++) {
    const tx = 2 + Math.floor(Math.random() * (GRID_W - 4));
    const ty = 5 + Math.floor(Math.random() * (GRID_H - 10));
    if (isSolidTile(tx, ty)) continue;
    const px = tx * TILE + 8, py = ty * TILE + 8;
    if (minDistFromPlayer && players &&
        players.some(pl => Math.hypot(px - pl.x, py - pl.y) < minDistFromPlayer)) continue;
    return { x: px, y: py };
  }
  return { x: CX * TILE, y: 30 * TILE };
}

// ---------------------------------------------------------- weapons
const WEAPONS = [
  { key: "cards",  name: "BINGO CARDS", spr: SPR_CARD,  dmg: 1, speed: 260, cooldown: 0.16,
    count: 1, spread: 0.10, pierce: 0, life: 0.9, max: 99, start: 60, sfx: "throwCard" },
  { key: "plates", name: "BUFFET PLATES", spr: SPR_PLATE, dmg: 3, speed: 200, cooldown: 0.5,
    count: 1, spread: 0.02, pierce: 2, life: 1.1, max: 30, start: 12, sfx: "throwPlate" },
  { key: "charms", name: "FREE CHARMS", spr: SPR_CHARM, dmg: 1, speed: 300, cooldown: 0.45,
    count: 5, spread: 0.45, pierce: 0, life: 0.45, max: 60, start: 25, sfx: "throwCharm" },
];

// ---------------------------------------------------------- state
const FINAL_WAVE = 10;
let state = "title"; // title | playing | wavebreak | gameover | victory
let players, crew, aliens, projectiles, gooProjs, particles, pickups, passengers, portals, floaters;
let wave, score, waveBreakT, shake, time = 0, boss = null;
let kills = 0;

function makePlayer(i) {
  return {
    x: CX * TILE + 8 + (i === 0 ? -14 : 14), y: 38 * TILE, w: 8, h: 10,
    speed: 92, dir: "down", anim: 0, moving: false,
    aimX: 0, aimY: 1, // throw in the direction you last walked
    weapon: 0, ammo: WEAPONS.map(w => w.start), fireT: 0, invulnT: 0, refillT: 0,
    spr: i === 0 ? PLAYER_SPR : PLAYER_SPR2,
    km: i === 0 ? P1_KEYS : P2_KEYS,
    label: "P" + (i + 1), color: i === 0 ? "#ffd23e" : "#7dc4ff",
  };
}

function resetGame() {
  // the shared passenger pool is both players' health
  crew = { hp: 10, maxHp: 10 };
  players = [makePlayer(0), makePlayer(1)];
  aliens = []; projectiles = []; gooProjs = []; particles = [];
  pickups = []; portals = []; floaters = [];
  // your health IS the passenger list: one passenger per hit point
  passengers = [];
  for (let i = 0; i < crew.maxHp; i++) {
    const p = randomWalkableTile(0);
    passengers.push(makePassenger(p.x, p.y, 0));
  }
  wave = 0; score = 0; kills = 0; shake = 0; boss = null;
  startWaveBreak();
}

function startWaveBreak() {
  state = "wavebreak";
  waveBreakT = wave === 0 ? 4 : 6;
}

function startWave() {
  wave++;
  state = "playing";
  sfx.wave();
  portals = [];
  if (wave === FINAL_WAVE) {
    // boss portal on the pool deck
    portals.push({ x: CX * TILE + 8, y: 22 * TILE + 8, queue: ["boss"], t: 2.5, interval: 1 });
    players.forEach(p => floatText("!! THE BROODMOTHER APPROACHES !!", p.x, p.y - 40, "#ff6ec7", 4));
    return;
  }
  const nPortals = Math.min(1 + Math.floor((wave - 1) / 2), 4);
  const count = 4 + wave * 3;
  const queueAll = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let kind = "drifter";
    if (wave >= 2 && r < 0.25) kind = "sprinter";
    if (wave >= 3 && r >= 0.25 && r < 0.42) kind = "spitter";
    if (wave >= 4 && r >= 0.42 && r < 0.58) kind = "bruiser";
    queueAll.push(kind);
  }
  for (let i = 0; i < nPortals; i++) {
    const pos = randomWalkableTile(140);
    portals.push({
      x: pos.x, y: pos.y,
      queue: queueAll.filter((_, j) => j % nPortals === i),
      t: 1.5 + Math.random(), interval: 1.1,
    });
  }
  sfx.portal();
}

const ALIEN_STATS = {
  drifter:  { hp: 3,  speed: 38, dmg: 1, score: 10, w: 9, h: 7 },
  sprinter: { hp: 2,  speed: 78, dmg: 1, score: 15, w: 9, h: 9 },
  bruiser:  { hp: 8,  speed: 26, dmg: 2, score: 25, w: 9, h: 7 },
  spitter:  { hp: 3,  speed: 42, dmg: 1, score: 20, w: 9, h: 9 },
  boss:     { hp: 150, speed: 22, dmg: 3, score: 500, w: 36, h: 30 },
};

function spawnAlien(kind, x, y) {
  const s = ALIEN_STATS[kind];
  const hpScale = kind === "boss" ? 1 : 1 + (wave - 1) * 0.15;
  const a = {
    kind, x, y, w: s.w, h: s.h,
    hp: Math.round(s.hp * hpScale), maxHp: Math.round(s.hp * hpScale),
    speed: s.speed * (0.9 + Math.random() * 0.2), dmg: s.dmg,
    anim: Math.random() * 10, hitT: 0, shootT: 2 + Math.random() * 2,
    strafe: Math.random() < 0.5 ? 1 : -1, spawnT: 0.6,
    ringT: 4, minionT: 6,
  };
  aliens.push(a);
  if (kind === "boss") boss = a;
  burst(x, y, "#a5ff9e", 14);
}

// ---------------------------------------------------------- passengers = health
function makePassenger(x, y, spawnT) {
  return {
    x, y, w: 8, h: 10, dirX: 0, dirY: 0, thinkT: Math.random() * 2,
    anim: Math.random() * 10,
    spr: PASSENGER_SPRS[Math.floor(Math.random() * PASSENGER_SPRS.length)],
    panicT: 0, state: "ok", abductT: 0, spawnT: spawnT || 0,
  };
}

// beam up the n passengers nearest to where the aliens struck
function abductPassengers(n, fromX, fromY) {
  const alive = passengers.filter(q => q.state === "ok");
  alive.sort((a, b) =>
    Math.hypot(a.x - fromX, a.y - fromY) - Math.hypot(b.x - fromX, b.y - fromY));
  for (let i = 0; i < Math.min(n, alive.length); i++) {
    const q = alive[i];
    q.state = "abducted";
    q.abductT = 0;
    q.riseY = 0;
    floatText("ABDUCTED!", q.x, q.y - 14, "#a5ff9e", 1.4);
  }
  if (alive.length > 0) sfx.abduct();
}

// abducted passengers beam back down near the rescuing player
function returnPassengers(p, n) {
  for (let i = 0; i < n; i++) {
    let pos = null;
    for (let tries = 0; tries < 60; tries++) {
      const ang = Math.random() * Math.PI * 2;
      const d = 24 + Math.random() * 40;
      const px = p.x + Math.cos(ang) * d, py = p.y + Math.sin(ang) * d;
      if (!boxSolid(px - 4, py - 5, px + 4, py + 5)) { pos = { x: px, y: py }; break; }
    }
    if (!pos) pos = randomWalkableTile(0);
    passengers.push(makePassenger(pos.x, pos.y, 0.9));
    floatText("RESCUED!", pos.x, pos.y - 14, "#7dff7d", 1.4);
  }
  if (n > 0) sfx.rescue();
}

function damagePlayer(p, dmg) {
  const before = crew.hp;
  crew.hp = Math.max(0, crew.hp - dmg);
  p.invulnT = 1.0;
  sfx.hurt();
  abductPassengers(before - crew.hp, p.x, p.y);
  if (crew.hp <= 0) {
    state = "gameover";
    sfx.gameover();
    players.forEach(q => burst(q.x, q.y, "#e8484d", 30));
  }
}

function healPlayer(p, n) {
  const gained = Math.min(n, crew.maxHp - crew.hp);
  crew.hp += gained;
  returnPassengers(p, gained);
  return gained;
}

// ---------------------------------------------------------- helpers
function floatText(text, x, y, color, life) {
  floaters.push({ text, x, y, color, t: life || 1.2, life: life || 1.2 });
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 20 + Math.random() * 70;
    particles.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      t: 0.3 + Math.random() * 0.4, color, size: 1 + (Math.random() * 2 | 0),
    });
  }
}
function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}
function collideMove(e, dx, dy) {
  // move with tile collision; entity box centered on x,y
  const hw = e.w / 2, hh = e.h / 2;
  // x axis
  let nx = e.x + dx;
  if (!boxSolid(nx - hw, e.y - hh, nx + hw, e.y + hh)) e.x = nx;
  let ny = e.y + dy;
  if (!boxSolid(e.x - hw, ny - hh, e.x + hw, ny + hh)) e.y = ny;
}
function boxSolid(x0, y0, x1, y1) {
  const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (isSolidTile(tx, ty)) return true;
  return false;
}
function pointSolid(x, y) { return isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE)); }

// ---------------------------------------------------------- pathfinding
// BFS flow field from the player's tile so aliens can navigate rooms/doors
const flow = new Int16Array(GRID_W * GRID_H);
const flowQueue = new Int32Array(GRID_W * GRID_H);
let flowT = 0;
function computeFlow() {
  // multi-source BFS: distance to the NEAREST player
  flow.fill(-1);
  let head = 0, tail = 0;
  for (const p of players) {
    const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
    if (isSolidTile(ptx, pty)) continue;
    const idx = pty * GRID_W + ptx;
    if (flow[idx] < 0) { flow[idx] = 0; flowQueue[tail++] = idx; }
  }
  while (head < tail) {
    const idx = flowQueue[head++];
    const tx = idx % GRID_W, ty = (idx / GRID_W) | 0;
    const d = flow[idx] + 1;
    // 4-neighborhood
    if (tx > 0 && !isSolidTile(tx - 1, ty) && flow[idx - 1] < 0) { flow[idx - 1] = d; flowQueue[tail++] = idx - 1; }
    if (tx < GRID_W - 1 && !isSolidTile(tx + 1, ty) && flow[idx + 1] < 0) { flow[idx + 1] = d; flowQueue[tail++] = idx + 1; }
    if (ty > 0 && !isSolidTile(tx, ty - 1) && flow[idx - GRID_W] < 0) { flow[idx - GRID_W] = d; flowQueue[tail++] = idx - GRID_W; }
    if (ty < GRID_H - 1 && !isSolidTile(tx, ty + 1) && flow[idx + GRID_W] < 0) { flow[idx + GRID_W] = d; flowQueue[tail++] = idx + GRID_W; }
  }
}
// direction an alien should move: straight chase when near, flow field when far
function chaseDir(a, dx, dy, dist) {
  if (dist < 48) return { x: dx / dist, y: dy / dist };
  const tx = Math.floor(a.x / TILE), ty = Math.floor(a.y / TILE);
  const here = flow[ty * GRID_W + tx];
  if (here <= 0) return { x: dx / dist, y: dy / dist };
  let best = here, bx = tx, by = ty;
  const cand = [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]];
  for (const [cx, cy] of cand) {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) continue;
    const f = flow[cy * GRID_W + cx];
    if (f >= 0 && f < best) { best = f; bx = cx; by = cy; }
  }
  if (bx === tx && by === ty) return { x: dx / dist, y: dy / dist };
  const gx = bx * TILE + TILE / 2 - a.x, gy = by * TILE + TILE / 2 - a.y;
  const gl = Math.hypot(gx, gy) || 1;
  return { x: gx / gl, y: gy / gl };
}

// ---------------------------------------------------------- input
const keys = {};

// one hand per player on a split keyboard (e.g. Glove80 halves)
const P1_KEYS = {
  up: ["w"], down: ["s"], left: ["a"], right: ["d"],
  // backspace/tab sit on the Glove80's left thumb cluster (no space on that half)
  fire: ["backspace", "f", "g", "v", "tab"], cycle: ["q", "e"], select: ["1", "2", "3"],
};
const P2_KEYS = {
  up: ["i", "arrowup"], down: ["k", "arrowdown"],
  left: ["j", "arrowleft"], right: ["l", "arrowright"],
  // space sits on the Glove80's right thumb cluster
  fire: [" ", "h", "n", ";", "'"], cycle: ["u", "o"], select: ["8", "9", "0"],
};
function anyDown(list) { for (const k of list) if (keys[k]) return true; return false; }

const PREVENT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "'", "Tab", "Backspace"]);
window.addEventListener("keydown", (e) => {
  if (PREVENT.has(e.key)) e.preventDefault();
  const k = e.key.toLowerCase();
  keys[k] = true;
  initAudio();
  if (players) {
    for (const p of players) {
      const si = p.km.select.indexOf(k);
      if (si >= 0) p.weapon = si;
      if (p.km.cycle.includes(k)) p.weapon = (p.weapon + 1) % WEAPONS.length;
    }
  }
  if (k === "m") muted = !muted;
  if ((state === "title" || state === "gameover" || state === "victory") &&
      (e.key === "Enter" || e.key === " ")) resetGame();
  if (state === "playing" && (k === "p" || k === "escape")) state = "paused";
  else if (state === "paused" && (k === "p" || k === "escape")) state = "playing";
});
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener("mousedown", () => {
  initAudio();
  if (state === "title" || state === "gameover" || state === "victory") resetGame();
});

// ---------------------------------------------------------- cameras (one per player)
const cams = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
function updateCamera() {
  players.forEach((p, i) => {
    cams[i].x = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x - VIEW_W / 2));
    cams[i].y = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y - VIEW_H / 2));
  });
}

// ---------------------------------------------------------- AI player 2 (MCP bridge)
// An MCP server (mcp-server.mjs) can drive player 2 over a local WebSocket.
// The AI sets a persistent intent; aiThink() executes it every frame with
// pathfinding, aiming and firing, so the AI only needs to issue a command
// when the situation changes.
const ai = {
  enabled: false, intent: null,
  flow: new Int16Array(GRID_W * GRID_H), flowTarget: -1,
};

// BFS flow field toward an arbitrary tile (separate from the alien one)
function computeAiFlow(ttx, tty) {
  ai.flowTarget = tty * GRID_W + ttx;
  ai.flow.fill(-1);
  let head = 0, tail = 0;
  ai.flow[ai.flowTarget] = 0;
  flowQueue[tail++] = ai.flowTarget;
  while (head < tail) {
    const idx = flowQueue[head++];
    const tx = idx % GRID_W, ty = (idx / GRID_W) | 0;
    const d = ai.flow[idx] + 1;
    if (tx > 0 && !isSolidTile(tx - 1, ty) && ai.flow[idx - 1] < 0) { ai.flow[idx - 1] = d; flowQueue[tail++] = idx - 1; }
    if (tx < GRID_W - 1 && !isSolidTile(tx + 1, ty) && ai.flow[idx + 1] < 0) { ai.flow[idx + 1] = d; flowQueue[tail++] = idx + 1; }
    if (ty > 0 && !isSolidTile(tx, ty - 1) && ai.flow[idx - GRID_W] < 0) { ai.flow[idx - GRID_W] = d; flowQueue[tail++] = idx - GRID_W; }
    if (ty < GRID_H - 1 && !isSolidTile(tx, ty + 1) && ai.flow[idx + GRID_W] < 0) { ai.flow[idx + GRID_W] = d; flowQueue[tail++] = idx + GRID_W; }
  }
}

function aiMoveToward(p, X, Y, out, stopDist) {
  const dist = Math.hypot(X - p.x, Y - p.y);
  if (dist <= stopDist) return;
  const ttx = Math.floor(X / TILE), tty = Math.floor(Y / TILE);
  if (isSolidTile(ttx, tty) || dist < 40) {
    out.dx = (X - p.x) / dist; out.dy = (Y - p.y) / dist;
    return;
  }
  if (ai.flowTarget !== tty * GRID_W + ttx) computeAiFlow(ttx, tty);
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const here = ai.flow[ty * GRID_W + tx];
  if (here <= 0) {
    out.dx = (X - p.x) / dist; out.dy = (Y - p.y) / dist;
    return;
  }
  let best = here, bx = tx, by = ty;
  for (const [cx, cy] of [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) continue;
    const f = ai.flow[cy * GRID_W + cx];
    if (f >= 0 && f < best) { best = f; bx = cx; by = cy; }
  }
  const gx = bx * TILE + TILE / 2 - p.x, gy = by * TILE + TILE / 2 - p.y;
  const gl = Math.hypot(gx, gy) || 1;
  out.dx = gx / gl; out.dy = gy / gl;
}

function aiNearest(arr, x, y) {
  let best = null, bd = Infinity;
  for (const e of arr) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// can a thrown item fly from a to b? (throws pass over water & pool)
function shotClear(x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0) || 1;
  const steps = Math.ceil(dist / 6);
  for (let i = 1; i < steps; i++) {
    const t = tileAt(Math.floor((x0 + (x1 - x0) * i / steps) / TILE),
                     Math.floor((y0 + (y1 - y0) * i / steps) / TILE));
    if (SOLID.has(t) && t !== T_WATER && t !== T_POOL) return false;
  }
  return true;
}

function aiThink(p) {
  const out = { dx: 0, dy: 0, fire: false };
  const intent = ai.intent;
  if (!intent) return out;
  switch (intent.action) {
    case "move_to":
      aiMoveToward(p, intent.x || 0, intent.y || 0, out, 6);
      break;
    case "follow":
      aiMoveToward(p, players[0].x, players[0].y, out, 36);
      break;
    case "collect": {
      const pk = aiNearest(pickups, p.x, p.y);
      if (pk) aiMoveToward(p, pk.x, pk.y, out, 2);
      break;
    }
    case "restock": {
      const st = stations.find(s => s.type === intent.weapon) ||
                 stations.find(s => s.type === WEAPONS[p.weapon].key);
      if (st) aiMoveToward(p, st.x, st.y, out, 24);
      break;
    }
    case "attack": {
      const ready = aliens.filter(a => a.spawnT <= 0);
      const target = intent.x !== undefined
        ? aiNearest(ready, intent.x, intent.y)
        : aiNearest(ready, p.x, p.y);
      if (!target) break;
      const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
      const w = WEAPONS[p.weapon];
      const range = Math.min(w.speed * w.life * 0.75, 170);
      const clear = shotClear(p.x, p.y - 4, target.x, target.y);
      if (d > range || !clear) aiMoveToward(p, target.x, target.y, out, 30);
      else if (d < 55) { out.dx = (p.x - target.x) / d; out.dy = (p.y - target.y) / d; } // keep distance
      if (clear && d < range) {
        const ax = target.x - p.x, ay = target.y - (p.y - 4);
        const al = Math.hypot(ax, ay) || 1;
        out.aimX = ax / al; out.aimY = ay / al;
        out.fire = true;
      }
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------- update
function update(dt) {
  time += dt;
  if (state === "paused" || state === "title" || state === "gameover" || state === "victory") return;

  for (const p of players) updatePlayer(p, dt);
  flowT -= dt;
  if (flowT <= 0) { computeFlow(); flowT = 0.35; }
  updatePortals(dt);
  updateAliens(dt);
  updateProjectiles(dt);
  updatePassengers(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateCamera();
  if (shake > 0) shake = Math.max(0, shake - dt * 20);

  if (state === "wavebreak") {
    waveBreakT -= dt;
    if (waveBreakT <= 0) startWave();
  } else if (state === "playing") {
    const pending = portals.some(p => p.queue.length > 0);
    if (!pending && aliens.length === 0) {
      score += wave * 50;
      players.forEach(p => floatText("WAVE " + wave + " CLEAR! +" + wave * 50, p.x, p.y - 24, "#ffd23e", 2));
      if (wave >= FINAL_WAVE) {
        state = "victory";
        sfx.victory();
      } else {
        startWaveBreak();
      }
    }
  }
}

function updatePlayer(p, dt) {
  let dx = 0, dy = 0, aiCmd = null;
  if (ai.enabled && p === players[1]) {
    aiCmd = aiThink(p);
    dx = aiCmd.dx; dy = aiCmd.dy;
  } else {
    if (anyDown(p.km.up)) dy -= 1;
    if (anyDown(p.km.down)) dy += 1;
    if (anyDown(p.km.left)) dx -= 1;
    if (anyDown(p.km.right)) dx += 1;
  }
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    collideMove(p, (dx / len) * p.speed * dt, (dy / len) * p.speed * dt);
    p.anim += dt * 10;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? "right" : "left";
    else p.dir = dy > 0 ? "down" : "up";
    // 8-way aim follows the direction you last walked
    p.aimX = dx / len; p.aimY = dy / len;
  }
  if (aiCmd && aiCmd.aimX !== undefined) { p.aimX = aiCmd.aimX; p.aimY = aiCmd.aimY; }
  p.fireT -= dt;
  p.invulnT -= dt;

  if ((aiCmd ? aiCmd.fire : anyDown(p.km.fire)) && p.fireT <= 0) throwWeapon(p);

  // station refills
  p.refillT -= dt;
  if (p.refillT <= 0) {
    for (const st of stations) {
      if (Math.hypot(st.x - p.x, st.y - p.y) < 34) {
        const wi = WEAPONS.findIndex(w => w.key === st.type);
        if (p.ammo[wi] < WEAPONS[wi].max) {
          p.ammo[wi] = Math.min(WEAPONS[wi].max, p.ammo[wi] + 3);
          sfx.refill();
          p.refillT = 0.18;
        }
      }
    }
  }
}

function throwWeapon(p) {
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] <= 0) {
    // auto-switch to a weapon with ammo
    const alt = p.ammo.findIndex(a => a > 0);
    if (alt >= 0) { p.weapon = alt; }
    else { p.fireT = 0.3; return; }
    return;
  }
  p.ammo[p.weapon]--;
  p.fireT = w.cooldown;
  const base = Math.atan2(p.aimY, p.aimX);
  for (let i = 0; i < w.count; i++) {
    const off = w.count === 1
      ? (Math.random() - 0.5) * w.spread
      : (i / (w.count - 1) - 0.5) * w.spread + (Math.random() - 0.5) * 0.05;
    const ang = base + off;
    projectiles.push({
      x: p.x, y: p.y - 4,
      vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
      dmg: w.dmg, pierce: w.pierce, life: w.life, spr: w.spr,
      rot: Math.random() * Math.PI * 2, rotV: 8 + Math.random() * 6,
      hitSet: new Set(),
    });
  }
  sfx[w.sfx]();
}

function updatePortals(dt) {
  for (const portal of portals) {
    if (portal.queue.length === 0) continue;
    portal.t -= dt;
    if (portal.t <= 0) {
      const kind = portal.queue.shift();
      spawnAlien(kind, portal.x + (Math.random() * 10 - 5), portal.y + (Math.random() * 10 - 5));
      portal.t = portal.interval;
    }
  }
}

function updateAliens(dt) {
  for (let i = aliens.length - 1; i >= 0; i--) {
    const a = aliens[i];
    a.anim += dt * 6;
    a.hitT -= dt;
    if (a.spawnT > 0) { a.spawnT -= dt; continue; }

    // chase whichever tourist is closer
    let p = players[0], pd = Infinity;
    for (const pl of players) {
      const d = Math.hypot(pl.x - a.x, pl.y - a.y);
      if (d < pd) { pd = d; p = pl; }
    }
    const dx = p.x - a.x, dy = p.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (a.kind === "spitter") {
      // keep mid range, strafe, spit goo
      let mx = 0, my = 0;
      if (dist > 130) { const v = chaseDir(a, dx, dy, dist); mx = v.x; my = v.y; }
      else if (dist < 90) { mx = -dx / dist; my = -dy / dist; }
      else { mx = (-dy / dist) * a.strafe; my = (dx / dist) * a.strafe; }
      const ox = a.x, oy = a.y;
      collideMove(a, mx * a.speed * dt, my * a.speed * dt);
      if (Math.abs(a.x - ox) < 0.01 && Math.abs(a.y - oy) < 0.01) a.strafe *= -1;
      a.shootT -= dt;
      if (a.shootT <= 0 && dist < 220) {
        a.shootT = 1.8 + Math.random();
        const ang = Math.atan2(dy, dx);
        gooProjs.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 110, vy: Math.sin(ang) * 110, life: 2.4 });
        beep(500, 0.1, "sawtooth", 0.04, -350);
      }
    } else if (a.kind === "boss") {
      const v = chaseDir(a, dx, dy, dist);
      collideMove(a, v.x * a.speed * dt, v.y * a.speed * dt);
      a.ringT -= dt;
      if (a.ringT <= 0) {
        a.ringT = 3.6;
        for (let k = 0; k < 10; k++) {
          const ang = (k / 10) * Math.PI * 2 + time;
          gooProjs.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 90, vy: Math.sin(ang) * 90, life: 3 });
        }
        beep(140, 0.3, "sawtooth", 0.08, 100);
      }
      a.minionT -= dt;
      if (a.minionT <= 0 && aliens.length < 12) {
        a.minionT = 6;
        spawnAlien("sprinter", a.x + 20, a.y);
        spawnAlien("drifter", a.x - 20, a.y);
      }
    } else {
      // chase via flow field (navigates doors), wall slide up close
      const v = chaseDir(a, dx, dy, dist);
      collideMove(a, v.x * a.speed * dt, v.y * a.speed * dt);
    }

    // contact damage (either player)
    for (const pl of players) {
      if (pl.invulnT <= 0 && rectsOverlap(a, pl)) {
        shake = 4;
        burst(pl.x, pl.y, "#e8484d", 8);
        // knock player back
        const kd = Math.hypot(pl.x - a.x, pl.y - a.y) || 1;
        collideMove(pl, (pl.x - a.x) / kd * 12, (pl.y - a.y) / kd * 12);
        damagePlayer(pl, a.dmg);
        if (state === "gameover") return;
      }
    }
  }
}

function updateProjectiles(dt) {
  // player projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.life -= dt;
    pr.rot += pr.rotV * dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    let dead = pr.life <= 0;
    // walls stop cards/charms; plates smash
    if (!dead && pointSolid(pr.x, pr.y)) {
      const t = tileAt(Math.floor(pr.x / TILE), Math.floor(pr.y / TILE));
      if (t !== T_POOL && t !== T_WATER) { // fly over water/pool
        dead = true;
        burst(pr.x, pr.y, "#e8e8f0", 4);
      }
    }
    if (!dead) {
      for (let j = aliens.length - 1; j >= 0; j--) {
        const a = aliens[j];
        if (a.spawnT > 0 || pr.hitSet.has(a)) continue;
        if (Math.abs(a.x - pr.x) * 2 < a.w + 6 && Math.abs(a.y - pr.y) * 2 < a.h + 6) {
          a.hp -= pr.dmg;
          a.hitT = 0.1;
          pr.hitSet.add(a);
          sfx.hit();
          burst(pr.x, pr.y, "#ffd23e", 4);
          // small knockback
          const d = Math.hypot(pr.vx, pr.vy) || 1;
          if (a.kind !== "boss") collideMove(a, (pr.vx / d) * 4, (pr.vy / d) * 4);
          if (a.hp <= 0) killAlien(j);
          if (pr.pierce > 0) pr.pierce--;
          else { dead = true; break; }
        }
      }
    }
    if (dead) projectiles.splice(i, 1);
  }
  // goo
  for (let i = gooProjs.length - 1; i >= 0; i--) {
    const g = gooProjs[i];
    g.life -= dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    let dead = g.life <= 0;
    if (!dead && pointSolid(g.x, g.y)) {
      const t = tileAt(Math.floor(g.x / TILE), Math.floor(g.y / TILE));
      if (t !== T_POOL && t !== T_WATER) { dead = true; burst(g.x, g.y, "#8aff3e", 3); }
    }
    if (!dead) {
      for (const pl of players) {
        if (pl.invulnT <= 0 &&
            Math.abs(pl.x - g.x) * 2 < pl.w + 4 &&
            Math.abs(pl.y - g.y) * 2 < pl.h + 4) {
          shake = 3;
          dead = true;
          damagePlayer(pl, 1);
          break;
        }
      }
    }
    if (dead) gooProjs.splice(i, 1);
  }
}

function killAlien(idx) {
  const a = aliens[idx];
  const s = ALIEN_STATS[a.kind];
  score += s.score;
  kills++;
  floatText("+" + s.score, a.x, a.y - 10, "#ffd23e", 0.9);
  burst(a.x, a.y, a.kind === "sprinter" ? "#ff6ec7" : a.kind === "bruiser" || a.kind === "boss" ? "#b07fe0" : a.kind === "spitter" ? "#2ad0b5" : "#4fd05a", 16);
  sfx.alienDie();
  aliens.splice(idx, 1);
  if (a.kind === "boss") { boss = null; shake = 8; return; }
  // drops
  const r = Math.random();
  if (r < 0.10) pickups.push({ kind: "soda", x: a.x, y: a.y, t: 14 });
  else if (r < 0.32) pickups.push({ kind: "ammo", x: a.x, y: a.y, t: 14 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.t -= dt;
    if (pk.t <= 0) { pickups.splice(i, 1); continue; }
    const taker = players.find(pl => Math.hypot(pk.x - pl.x, pk.y - pl.y) < 12);
    if (taker) {
      if (pk.kind === "soda") {
        const got = healPlayer(taker, 2);
        floatText(got > 0 ? "+" + got + " PASSENGERS BACK" : "ALL ABOARD ALREADY", pk.x, pk.y - 10, "#7dff7d", 1);
      } else {
        const wi = Math.floor(Math.random() * WEAPONS.length);
        taker.ammo[wi] = Math.min(WEAPONS[wi].max, taker.ammo[wi] + Math.ceil(WEAPONS[wi].max / 4));
        floatText("+" + WEAPONS[wi].name, pk.x, pk.y - 10, "#ffd23e", 1);
      }
      sfx.pickup();
      pickups.splice(i, 1);
    }
  }
}

function updatePassengers(dt) {
  for (let i = passengers.length - 1; i >= 0; i--) {
    const q = passengers[i];
    if (q.state === "abducted") {
      // beamed up into the sky, then gone
      q.abductT += dt;
      q.riseY += dt * 42 * Math.min(2, q.abductT * 2);
      if (q.abductT > 1.6) passengers.splice(i, 1);
      continue;
    }
    if (q.spawnT > 0) { q.spawnT -= dt; continue; }
    q.anim += dt * 8;
    q.thinkT -= dt;
    q.panicT -= dt;
    // panic if an alien is near
    let nearest = null, nd = 70;
    for (const a of aliens) {
      const d = Math.hypot(a.x - q.x, a.y - q.y);
      if (d < nd) { nd = d; nearest = a; }
    }
    if (nearest) {
      q.dirX = (q.x - nearest.x) / nd;
      q.dirY = (q.y - nearest.y) / nd;
      q.panicT = 0.6;
    } else if (q.thinkT <= 0) {
      q.thinkT = 1 + Math.random() * 3;
      if (Math.random() < 0.4) { q.dirX = 0; q.dirY = 0; }
      else {
        const a = Math.random() * Math.PI * 2;
        q.dirX = Math.cos(a); q.dirY = Math.sin(a);
      }
    }
    const speed = q.panicT > 0 ? 80 : 28;
    if (q.dirX || q.dirY) {
      const ox = q.x, oy = q.y;
      collideMove(q, q.dirX * speed * dt, q.dirY * speed * dt);
      if (Math.abs(q.x - ox) < 0.01 && Math.abs(q.y - oy) < 0.01) { q.dirX = -q.dirX; q.dirY = -q.dirY; }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t -= dt;
    if (p.t <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t -= dt;
    f.y -= 14 * dt;
    if (f.t <= 0) floaters.splice(i, 1);
  }
}

// ---------------------------------------------------------- render
function tileColor(t, tx, ty) {
  switch (t) {
    case T_WATER: {
      const wob = Math.sin(tx * 1.3 + ty * 0.7 + time * 1.5) > 0.75;
      return wob ? "#1e3f7a" : "#16305e";
    }
    case T_DECK: return (ty % 2 === 0) ? "#b98a52" : "#ab7d48";
    case T_SHUFFLE: return (tx + ty) % 2 === 0 ? "#c99a5f" : "#8f6a3c";
    case T_POOL: {
      const wob = Math.sin(tx * 2.1 - ty * 1.3 + time * 2.5) > 0.6;
      return wob ? "#4fc7e8" : "#2fa8d0";
    }
    case T_POOL_EDGE: return "#d8d8e0";
    case T_CARPET: return (tx + ty) % 2 === 0 ? "#7a2030" : "#6a1a28";
    case T_WALL: return "#e8e4da";
    case T_RAIL: return "#f0ede4";
    case T_TABLE: return "#5c3a1e";
    case T_ST_PLATES: return "#8a5a2a";
    case T_ST_CARDS: return "#274e8a";
    case T_ST_CHARMS: return "#6a4a8a";
  }
  return "#f0f";
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a1030";
  ctx.fillRect(0, 0, CANVAS_W, VIEW_H);

  if (state === "title") { renderTitle(); return; }

  for (let vi = 0; vi < players.length; vi++) renderView(vi);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // divider between the two views
  ctx.fillStyle = "#2a2a4a";
  ctx.fillRect(VIEW_W, 0, SPLIT_GAP, VIEW_H);
  renderHUD();
  renderOverlays();
}

// one player's viewport, clipped to their half of the canvas
function renderView(vi) {
  const cam = cams[vi];
  const ox = vi * (VIEW_W + SPLIT_GAP);
  const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  ctx.rect(ox, 0, VIEW_W, VIEW_H);
  ctx.clip();
  ctx.setTransform(1, 0, 0, 1, Math.round(ox - cam.x + sx), Math.round(-cam.y + sy));

  // tiles
  const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const tx1 = Math.min(GRID_W - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1);
  const ty1 = Math.min(GRID_H - 1, Math.ceil((cam.y + VIEW_H) / TILE) + 1);
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = tileAt(tx, ty);
      ctx.fillStyle = tileColor(t, tx, ty);
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      // details
      if (t === T_DECK && (tx * 7 + ty * 13) % 5 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(tx * TILE, ty * TILE + 7, TILE, 1);
      }
      if (t === T_RAIL) {
        ctx.fillStyle = "#b8b4a8";
        ctx.fillRect(tx * TILE + 2, ty * TILE + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "#f0ede4";
        ctx.fillRect(tx * TILE + 5, ty * TILE + 5, TILE - 10, TILE - 10);
      }
      if (t === T_WALL) {
        ctx.fillStyle = "#c8c4ba";
        ctx.fillRect(tx * TILE, ty * TILE + TILE - 3, TILE, 3);
      }
      if (t === T_TABLE) {
        ctx.fillStyle = "#7a5230";
        ctx.fillRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 3);
      }
      if (t === T_ST_PLATES) {
        ctx.drawImage(SPR_PLATE, tx * TILE + 4, ty * TILE + 4);
      }
      if (t === T_ST_CARDS) {
        ctx.drawImage(SPR_CARD, tx * TILE + 4, ty * TILE + 5);
      }
      if (t === T_ST_CHARMS) {
        ctx.drawImage(SPR_CHARM, tx * TILE + 5, ty * TILE + 5);
      }
    }

  // station labels
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  for (const st of stations) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(st.label, st.x, st.y - 12);
  }

  // portals
  for (const portal of portals) {
    if (portal.queue.length === 0) continue;
    const r = 10 + Math.sin(time * 6) * 2;
    ctx.strokeStyle = "#a5ff9e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(120,255,120,0.25)";
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // pickups
  for (const pk of pickups) {
    const bob = Math.sin(time * 5 + pk.x) * 2;
    const spr = pk.kind === "soda" ? SPR_SODA : SPR_AMMO;
    if (pk.t > 3 || Math.floor(time * 8) % 2 === 0)
      ctx.drawImage(spr, Math.round(pk.x - spr.width / 2), Math.round(pk.y - spr.height / 2 + bob));
  }

  // passengers
  for (const q of passengers) {
    if (q.state === "abducted") {
      // green tractor beam from above, passenger rising and flickering
      const fade = Math.max(0, 1 - q.abductT / 1.6);
      ctx.fillStyle = "rgba(120,255,140," + (0.28 * fade) + ")";
      ctx.fillRect(Math.round(q.x - 7), Math.round(q.y - q.riseY - 70), 14, Math.round(q.riseY + 66));
      ctx.fillStyle = "rgba(220,255,220," + (0.5 * fade) + ")";
      ctx.fillRect(Math.round(q.x - 3), Math.round(q.y - q.riseY - 70), 6, Math.round(q.riseY + 66));
      if (Math.floor(time * 10) % 2 === 0) {
        ctx.globalAlpha = fade;
        ctx.drawImage(q.spr.down[0], Math.round(q.x - 5), Math.round(q.y - 10 - q.riseY));
        ctx.globalAlpha = 1;
      }
      continue;
    }
    if (q.spawnT > 0) {
      // beam-down shimmer as a rescued passenger returns
      ctx.fillStyle = "rgba(150,220,255," + (0.6 * (q.spawnT / 0.9)) + ")";
      ctx.fillRect(Math.round(q.x - 5), Math.round(q.y - 12 - 8 * (q.spawnT / 0.9)), 10, 14);
      continue;
    }
    const f = q.spr.down[Math.floor(q.anim) % 2];
    ctx.drawImage(f, Math.round(q.x - 5), Math.round(q.y - 10));
    if (q.panicT > 0 && Math.floor(time * 6) % 2 === 0) {
      ctx.fillStyle = "#fff";
      ctx.fillText("!", Math.round(q.x), Math.round(q.y - 12));
    }
  }

  // aliens
  for (const a of aliens) {
    if (a.spawnT > 0) {
      // teleport-in shimmer
      ctx.fillStyle = "rgba(160,255,160," + (0.7 * (a.spawnT / 0.6)) + ")";
      ctx.fillRect(a.x - 5, a.y - 5 - 6 * (a.spawnT / 0.6), 10, 12);
      continue;
    }
    let spr;
    if (a.kind === "boss") spr = Math.floor(a.anim) % 2 ? BOSS_SPR2 : BOSS_SPR;
    else spr = ALIEN_SPRS[a.kind][Math.floor(a.anim) % 2];
    if (a.hitT > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#fff";
      ctx.fillRect(a.x - spr.width / 2 - 1, a.y - spr.height / 2 - 1, spr.width + 2, spr.height + 2);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(spr, Math.round(a.x - spr.width / 2), Math.round(a.y - spr.height / 2));
    // hp bar for bruisers/boss
    if ((a.kind === "bruiser" || a.kind === "boss") && a.hp < a.maxHp) {
      const w = a.kind === "boss" ? 36 : 12;
      ctx.fillStyle = "#301020";
      ctx.fillRect(a.x - w / 2, a.y - spr.height / 2 - 5, w, 2);
      ctx.fillStyle = "#e8484d";
      ctx.fillRect(a.x - w / 2, a.y - spr.height / 2 - 5, w * (a.hp / a.maxHp), 2);
    }
  }

  // players (flash while invulnerable), with label + aim tick
  for (const p of players) {
    if (p.invulnT <= 0 || Math.floor(time * 12) % 2 === 0) {
      const frames = p.spr[p.dir];
      const f = frames[p.moving ? Math.floor(p.anim) % 2 : 0];
      ctx.drawImage(f, Math.round(p.x - 5), Math.round(p.y - 10));
    }
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x + p.aimX * 11) - 1, Math.round(p.y - 3 + p.aimY * 11) - 1, 2, 2);
    ctx.font = "6px monospace";
    ctx.textAlign = "center";
    const tag = ai.enabled && p === players[1] ? p.label + "·AI" : p.label;
    ctx.fillText(tag, Math.round(p.x), Math.round(p.y - 13));
    ctx.textAlign = "left";
  }

  // projectiles
  for (const pr of projectiles) {
    ctx.save();
    ctx.translate(Math.round(pr.x), Math.round(pr.y));
    ctx.rotate(Math.round(pr.rot / (Math.PI / 8)) * (Math.PI / 8)); // chunky rotation
    ctx.drawImage(pr.spr, -pr.spr.width / 2, -pr.spr.height / 2);
    ctx.restore();
  }
  for (const g of gooProjs) {
    ctx.drawImage(SPR_GOO, Math.round(g.x - 2), Math.round(g.y - 2));
  }

  // particles
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }

  // floating text
  ctx.font = "8px monospace";
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.t / (f.life * 0.5));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
  ctx.restore();
}

// full-canvas overlays (screen space)
function renderOverlays() {
  if (state === "wavebreak") {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(CANVAS_W / 2 - 110, 40, 220, 34);
    ctx.fillStyle = "#ffd23e";
    ctx.font = "10px monospace";
    const next = wave + 1;
    ctx.fillText(next === FINAL_WAVE ? "FINAL WAVE INCOMING..." : "WAVE " + next + " INCOMING...", CANVAS_W / 2, 55);
    ctx.fillStyle = "#fff";
    ctx.fillText(Math.ceil(waveBreakT) + "", CANVAS_W / 2, 68);
    ctx.textAlign = "left";
  }
  if (state === "paused") {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, CANVAS_W, VIEW_H);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", CANVAS_W / 2, VIEW_H / 2);
    ctx.font = "8px monospace";
    ctx.fillText("press P to resume", CANVAS_W / 2, VIEW_H / 2 + 14);
    ctx.textAlign = "left";
  }
  if (state === "gameover") renderGameOver();
  if (state === "victory") renderVictory();
}

function renderHUD() {
  // shared passenger roster = health, centered over the divider
  const shirtCols = ["#3fa14d", "#8a4fd0", "#e88f2a", "#2ab5c9", "#d94f9e"];
  const rosterX = Math.round(CANVAS_W / 2 - (crew.maxHp * 9 - 3) / 2);
  for (let i = 0; i < crew.maxHp; i++) {
    const x = rosterX + i * 9, y = 6;
    const aboard = i < crew.hp;
    if (aboard) {
      ctx.fillStyle = "#f2c396";                  // head
      ctx.fillRect(x + 1, y, 4, 3);
      ctx.fillStyle = shirtCols[i % shirtCols.length]; // shirt
      ctx.fillRect(x, y + 3, 6, 4);
      ctx.fillStyle = "#3b5c8f";                  // legs
      ctx.fillRect(x + 1, y + 7, 1, 2); ctx.fillRect(x + 4, y + 7, 1, 2);
    } else {
      ctx.fillStyle = "rgba(160,255,160,0.28)";   // abducted: faint green silhouette
      ctx.fillRect(x + 1, y, 4, 3);
      ctx.fillRect(x, y + 3, 6, 4);
      ctx.fillRect(x + 1, y + 7, 1, 2); ctx.fillRect(x + 4, y + 7, 1, 2);
    }
  }
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = crew.hp <= 2 ? "#e8484d" : "#b8c4d8";
  ctx.fillText("PASSENGERS " + crew.hp + "/" + crew.maxHp, CANVAS_W / 2, 24);
  ctx.textAlign = "left";
  // wave + score
  ctx.font = "8px monospace";
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd23e";
  ctx.fillText("WAVE " + Math.max(1, wave) + (state === "wavebreak" ? " (next: " + (wave + 1) + ")" : "") , CANVAS_W - 6, 12);
  ctx.fillStyle = "#fff";
  ctx.fillText("SCORE " + score, CANVAS_W - 6, 22);
  ctx.textAlign = "left";
  if (boss) {
    ctx.fillStyle = "#301020";
    ctx.fillRect(CANVAS_W / 2 - 60, 30, 120, 6);
    ctx.fillStyle = "#ff6ec7";
    ctx.fillRect(CANVAS_W / 2 - 60, 30, 120 * (boss.hp / boss.maxHp), 6);
    ctx.fillStyle = "#fff";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BROODMOTHER", CANVAS_W / 2, 44);
    ctx.textAlign = "left";
  }

  // per-player weapon slots along the bottom of each view
  const slotW = 88, slotH = 20;
  players.forEach((p, vi) => {
    const ox = vi * (VIEW_W + SPLIT_GAP);
    ctx.font = "7px monospace";
    ctx.fillStyle = p.color;
    ctx.fillText(ai.enabled && vi === 1 ? p.label + "·AI" : p.label, ox + 6, VIEW_H - slotH - 10);
    for (let i = 0; i < WEAPONS.length; i++) {
      const x = ox + 6 + i * (slotW + 4), y = VIEW_H - slotH - 6;
      const w = WEAPONS[i];
      ctx.fillStyle = i === p.weapon ? "rgba(255,210,62,0.25)" : "rgba(0,0,0,0.45)";
      ctx.fillRect(x, y, slotW, slotH);
      ctx.strokeStyle = i === p.weapon ? p.color : "#555577";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, slotW - 1, slotH - 1);
      ctx.drawImage(w.spr, x + 4, y + Math.floor((slotH - w.spr.height) / 2));
      ctx.fillStyle = p.ammo[i] === 0 ? "#e8484d" : "#fff";
      ctx.fillText("[" + p.km.select[i] + "] " + w.name, x + 15, y + 8);
      ctx.fillText("x" + p.ammo[i], x + 15, y + 16);
    }
  });
}

function renderTitle() {
  // animated ocean
  for (let ty = 0; ty < VIEW_H / TILE; ty++)
    for (let tx = 0; tx < Math.ceil(CANVAS_W / TILE); tx++) {
      ctx.fillStyle = tileColor(T_WATER, tx, ty);
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  // little ship silhouette cruising by
  const shipX = (time * 20) % (CANVAS_W + 160) - 80;
  ctx.fillStyle = "#e8e4da";
  ctx.fillRect(shipX, 282, 70, 12);
  ctx.fillRect(shipX + 8, 274, 54, 8);
  ctx.fillRect(shipX + 18, 266, 30, 8);
  ctx.fillStyle = "#e8484d";
  ctx.fillRect(shipX + 30, 260, 8, 6);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a5ff9e";
  ctx.font = "26px monospace";
  ctx.fillText("ALIENS ON DECK!", CANVAS_W / 2, 64);
  ctx.fillStyle = "#ffd23e";
  ctx.font = "9px monospace";
  ctx.fillText("the S.S. Starlight is under attack — grab a buddy:", CANVAS_W / 2, 86);
  ctx.fillText("two tourists, one keyboard, half each!", CANVAS_W / 2, 98);

  // one control column per player, over their side of the screen
  ctx.font = "8px monospace";
  const c1 = CANVAS_W * 0.27, c2 = CANVAS_W * 0.73;
  ctx.fillStyle = "#ffd23e";
  ctx.fillText("PLAYER 1 — left hand", c1, 124);
  ctx.fillStyle = "#7dc4ff";
  ctx.fillText("PLAYER 2 — right hand", c2, 124);
  ctx.fillStyle = "#fff";
  const p1Lines = [
    "W A S D ........ move",
    "BKSP or F ...... throw",
    "Q / E .......... switch item",
    "1 2 3 .......... pick item",
  ];
  const p2Lines = [
    "I J K L ........ move",
    "SPACE or H ..... throw",
    "U / O .......... switch item",
    "8 9 0 .......... pick item",
  ];
  p1Lines.forEach((l, i) => ctx.fillText(l, c1, 140 + i * 12));
  p2Lines.forEach((l, i) => ctx.fillText(l, c2, 140 + i * 12));

  const shared = [
    "you throw in the direction you last walked",
    "restock at the BUFFET, BINGO hall & gift SHOP",
    "every hit EITHER of you takes, a PASSENGER is abducted!",
    "grab sodas to beam them back — lose all 10 & it's over",
    "P pause   M mute",
  ];
  shared.forEach((l, i) => ctx.fillText(l, CANVAS_W / 2, 196 + i * 12));

  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = "#a5ff9e";
    ctx.font = "10px monospace";
    ctx.fillText("- PRESS ENTER OR CLICK TO BOARD -", CANVAS_W / 2, 288);
  }
  ctx.textAlign = "left";
}

function renderGameOver() {
  ctx.fillStyle = "rgba(20,0,10,0.7)";
  ctx.fillRect(0, 0, CANVAS_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8484d";
  ctx.font = "22px monospace";
  ctx.fillText("ALL ABDUCTED!", CANVAS_W / 2, 120);
  ctx.fillStyle = "#fff";
  ctx.font = "9px monospace";
  ctx.fillText("every last passenger was beamed away... even the cruise director", CANVAS_W / 2, 145);
  ctx.fillText("SCORE: " + score + "   WAVES: " + wave + "   ALIENS SPLATTED: " + kills, CANVAS_W / 2, 165);
  if (Math.floor(time * 2) % 2 === 0)
    ctx.fillText("- PRESS ENTER TO TRY AGAIN -", CANVAS_W / 2, 200);
  ctx.textAlign = "left";
}

function renderVictory() {
  ctx.fillStyle = "rgba(0,10,25,0.7)";
  ctx.fillRect(0, 0, CANVAS_W, VIEW_H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23e";
  ctx.font = "20px monospace";
  ctx.fillText("SHIP SAVED!", CANVAS_W / 2, 110);
  ctx.fillStyle = "#a5ff9e";
  ctx.font = "9px monospace";
  ctx.fillText("the Broodmother is defeated by the dynamic tourist duo —", CANVAS_W / 2, 135);
  ctx.fillText(crew.hp + " of " + crew.maxHp + " passengers make the conga line at 8pm sharp.", CANVAS_W / 2, 147);
  ctx.fillStyle = "#fff";
  ctx.fillText("FINAL SCORE: " + score + "   ALIENS SPLATTED: " + kills, CANVAS_W / 2, 170);
  // confetti
  for (let i = 0; i < 80; i++) {
    const x = (i * 137 + time * 40) % CANVAS_W;
    const y = (i * 61 + time * (30 + (i % 5) * 10)) % VIEW_H;
    ctx.fillStyle = ["#e8484d", "#ffd23e", "#4fd05a", "#2ad0b5", "#ff6ec7"][i % 5];
    ctx.fillRect(x, y, 3, 3);
  }
  if (Math.floor(time * 2) % 2 === 0)
    ctx.fillText("- PRESS ENTER FOR ANOTHER CRUISE -", CANVAS_W / 2, 215);
  ctx.textAlign = "left";
}

// ---------------------------------------------------------- MCP bridge (websocket)
function applyAICommand(cmd) {
  if (!cmd || typeof cmd !== "object") return "ignored";
  if (cmd.action === "release") {
    ai.enabled = false; ai.intent = null;
    return "player 2 handed back to human control";
  }
  if (cmd.action === "select_weapon") {
    if (!players) return "no game running";
    const wi = WEAPONS.findIndex(w => w.key === cmd.weapon);
    if (wi >= 0) players[1].weapon = wi;
    ai.enabled = true;
    return "weapon: " + WEAPONS[players[1].weapon].name;
  }
  ai.enabled = true;
  ai.intent = cmd;
  return "intent set: " + cmd.action;
}

function snapshotState() {
  const r = Math.round;
  const p2 = players && players[1];
  return {
    state, wave, score,
    crew: crew ? { hp: crew.hp, maxHp: crew.maxHp } : null,
    aiEnabled: ai.enabled,
    intent: ai.intent,
    players: players ? players.map(p => ({
      x: r(p.x), y: r(p.y),
      weapon: WEAPONS[p.weapon].key,
      ammo: { cards: p.ammo[0], plates: p.ammo[1], charms: p.ammo[2] },
    })) : null,
    aliens: (aliens || [])
      .map(a => ({ kind: a.kind, x: r(a.x), y: r(a.y), hp: a.hp,
                   dist: p2 ? r(Math.hypot(a.x - p2.x, a.y - p2.y)) : 0 }))
      .sort((a, b) => a.dist - b.dist).slice(0, 30),
    pickups: (pickups || []).map(k => ({ kind: k.kind, x: r(k.x), y: r(k.y) })),
    portalsPending: (portals || []).reduce((n, q) => n + q.queue.length, 0),
    stations: stations.map(s => ({ type: s.type, x: r(s.x), y: r(s.y) })),
  };
}

// connect to the local MCP bridge (mcp-server.mjs); retry quietly if absent
(function connectAI() {
  if (!/^https?:$/.test(location.protocol)) return;
  let sock;
  try { sock = new WebSocket("ws://localhost:8322"); } catch (e) { return; }
  sock.onmessage = (ev) => {
    advance(performance.now()); // catch the sim up even in a throttled tab
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    const reply = (data) => sock.send(JSON.stringify(Object.assign({ id: msg.id }, data)));
    if (msg.type === "state") reply({ data: snapshotState() });
    else if (msg.type === "command") reply({ note: applyAICommand(msg.command), data: snapshotState() });
    else if (msg.type === "press") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: msg.key }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: msg.key }));
      reply({ ok: true, data: snapshotState() });
    }
  };
  sock.onclose = () => { ai.enabled = false; ai.intent = null; setTimeout(connectAI, 3000); };
  sock.onerror = () => {};
})();

// ---------------------------------------------------------- debug hook (used by automated tests)
window.__aod = {
  get state() { return state; },
  get wave() { return wave; },
  get score() { return score; },
  get kills() { return kills; },
  get player() { return players && players[0]; },
  get players() { return players; },
  get crew() { return crew; },
  get aliens() { return aliens; },
  get passengers() { return passengers; },
  get cam() { return { x: cams[0].x, y: cams[0].y }; },
  get cams() { return cams; },
  damage(n) { players[0].invulnT = 0; damagePlayer(players[0], n); },
  heal(n) { return healPlayer(players[0], n); },
};

// ---------------------------------------------------------- loop
// fixed-step simulation with catch-up: rAF drives it while the tab is
// visible; a timer (and websocket traffic) keeps the game running when
// rAF is paused, so the AI can keep playing in a background tab
let lastT = performance.now();
let lastRaf = 0;
function advance(now) {
  let behind = now - lastT;
  if (behind > 1000) { lastT = now - 1000; behind = 1000; } // cap catch-up
  while (behind >= 16) { update(0.016); lastT += 16; behind -= 16; }
}
function frame(now) {
  lastRaf = now;
  advance(now);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(() => {
  const now = performance.now();
  if (now - lastRaf > 200) advance(now); // rAF is starved; simulate anyway
}, 100);

})();
