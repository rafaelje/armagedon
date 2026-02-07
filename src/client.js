let canvas = null;
let ctx = null;

const commentaryState = {
  text: "",
  timer: 0,
  duration: 4,
  popTimer: 0,
};

const keys = new Set();

const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
  navigator.userAgent
) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

if (isMobile && screen.orientation && screen.orientation.lock) {
  screen.orientation.lock("landscape").catch(() => {});
}

const touchButtons = [];
const activeTouches = new Map();

const net = {
  enabled: false,
  ws: null,
  connected: false,
  playerId: null,
  team: null,
  url: "",
  prevState: null,
  currState: null,
  lastReceived: 0,
  intervalMs: 33,
};

const state = {
  dpr: 1,
  width: 0,
  height: 0,
  terrain: [],
  worms: [],
  currentIndex: 0,
  weaponIndex: 0,
  projectiles: [],
  charging: false,
  charge: 0,
  chargeDir: 1,
  gameOver: false,
  winner: null,
  aiTimer: 0,
  aiPlan: null,
  explosions: [],
  wind: 0,
  clouds: [],
  windGusts: [],
  gustTimer: 0,
  gustExtra: 0,
  seed: 0,
  turnTimer: 30,
  turnTimerMax: 30,
  healthPacks: [],
  packSpawnTimer: 0,
};

const visuals = {
  width: 0,
  height: 0,
  seed: 0,
  bgCanvas: null,
  soilPattern: null,
};

const WIND_SCALE = 20;

const config = {
  gravity: 900,
  moveSpeed: 90,
  angleSpeed: 90,
  wormRadius: 12,
  chargeRate: 0.9,
  minWormDistance: 30,
};

const weapons = [
  {
    id: "bazooka",
    name: "Bazooka",
    minSpeed: 400,
    maxSpeed: 1200,
    explosionRadius: 55,
    maxDamage: 60,
    bounciness: 0,
    fuse: 0,
    gravityScale: 0.9,
  },
  {
    id: "grenade",
    name: "Granada",
    minSpeed: 400,
    maxSpeed: 1200,
    explosionRadius: 70,
    maxDamage: 75,
    bounciness: 0.45,
    fuse: 6.6,
    gravityScale: 0.9,
  },
  {
    id: "mortar",
    name: "Mortero",
    minSpeed: 400,
    maxSpeed: 1200,
    explosionRadius: 85,
    maxDamage: 90,
    bounciness: 0,
    fuse: 0,
    gravityScale: 0.9,
  },
  {
    id: "sniper",
    name: "Sniper",
    minSpeed: 400,
    maxSpeed: 1200,
    explosionRadius: 26,
    maxDamage: 85,
    bounciness: 0,
    fuse: 0,
    gravityScale: 0.9,
    projectileRadius: 3,
  },
  {
    id: "pistol",
    name: "Pistola x3",
    minSpeed: 400,
    maxSpeed: 1200,
    explosionRadius: 18,
    maxDamage: 22,
    bounciness: 0,
    fuse: 0,
    gravityScale: 0.9,
    projectileRadius: 3,
    burst: 3,
    burstSpread: 6,
    burstSpeedJitter: 0.04,
  },
];

const aiConfig = {
  enabled: true,
  team: "Azul",
  thinkDelayMin: 0.5,
  thinkDelayMax: 1.2,
  angleStep: 5,
  powerMin: 0.35,
  powerStep: 0.07,
  powerMax: 1,
  simStep: 0.02,
  simMaxTime: 3.8,
  moveChance: 0.7,
  moveDistMin: 30,
  moveDistMax: 120,
  moveTimeMax: 2.5,
};

const commentary = {
  turn: [
    "Turno de {name}. Que no se le vaya la mano.",
    "¡{name} al ruedo!",
    "{name} toma el control. Respiren.",
    "El público pide precisión, {name}.",
  ],
  fire: [
    "¡Vuela, proyectil, vuela!",
    "Eso salió con más fe que puntería.",
    "¡Un disparo para los libros... de accidentes!",
    "¡Cuidado, que va con cariño!",
    "¡Lanzamiento digno de circo!",
  ],
  boom: [
    "¡Eso fue un masaje explosivo!",
    "¡Tierra abierta, orgullo cerrado!",
    "¡El suelo también sufre!",
    "¡Craterazo nivel experto!",
  ],
  hit: [
    "¡Directo al ego!",
    "¡Ese sí dolió!",
    "¡Golpe limpio, 10 puntos!",
    "¡Eso deja marca!",
  ],
  kill: [
    "¡Se fue a ver lombrices al cielo!",
    "¡KO con estilo!",
    "¡Bye bye, gusano valiente!",
  ],
  heal: [
    "¡Botiquín al rescate!",
    "¡Vitaminas gratis!",
    "¡Salud que cae del cielo!",
    "¡Curitas para todos!",
  ],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getAimBounds(team) {
  if (team === "Rojo") {
    return { min: -15, max: 165 };
  }
  if (team === "Azul") {
    return { min: 15, max: 195 };
  }
  return { min: 15, max: 165 };
}

function createRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
  }

  create() {
    canvas = this.sys.game.canvas;
    ctx = this.sys.game.context || canvas.getContext("2d");
    resize(this.scale.width, this.scale.height);
    this.scale.on("resize", (gameSize) => {
      resize(gameSize.width, gameSize.height);
    });
    this.sys.game.events.on("postrender", () => {
      render();
    });
    bindInput(this);
  }

  update(_time, delta) {
    step(delta / 1000);
  }
}

const phaserConfig = {
  type: Phaser.CANVAS,
  canvas: document.getElementById("game"),
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
};

new Phaser.Game(phaserConfig);
// connectNet(); // Moved to UI interaction

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function seededRand(rng, min, max) {
  return rng() * (max - min) + min;
}

function ensureVisuals() {
  if (!ctx || !state.width || !state.height) return;
  if (
    visuals.width === state.width &&
    visuals.height === state.height &&
    visuals.seed === (state.seed || 1) &&
    visuals.bgCanvas &&
    visuals.soilPattern
  ) {
    return;
  }
  visuals.width = state.width;
  visuals.height = state.height;
  visuals.seed = state.seed || 1;
  buildBackground();
  buildSoilPattern();
}

function buildBackground() {
  const bg = document.createElement("canvas");
  bg.width = state.width;
  bg.height = state.height;
  const gctx = bg.getContext("2d");

  const sky = gctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#4a8bd6");
  sky.addColorStop(0.55, "#8ec6ff");
  sky.addColorStop(1, "#dff2ff");
  gctx.fillStyle = sky;
  gctx.fillRect(0, 0, state.width, state.height);

  const sun = gctx.createRadialGradient(
    state.width * 0.72,
    state.height * 0.2,
    20,
    state.width * 0.72,
    state.height * 0.2,
    state.height * 0.35
  );
  sun.addColorStop(0, "rgba(255, 255, 230, 0.85)");
  sun.addColorStop(1, "rgba(255, 255, 230, 0)");
  gctx.fillStyle = sun;
  gctx.beginPath();
  gctx.arc(state.width * 0.72, state.height * 0.2, state.height * 0.35, 0, Math.PI * 2);
  gctx.fill();

  const rng = createRng((state.seed || 1) ^ 0x9e3779b9);
  drawMountainLayer(gctx, rng, state.height * 0.62, state.height * 0.18, "#5f7ea8", 0.35);
  drawMountainLayer(gctx, rng, state.height * 0.7, state.height * 0.24, "#4c6d94", 0.55);

  visuals.bgCanvas = bg;
}

function drawMountainLayer(gctx, rng, baseY, amp, color, alpha) {
  gctx.save();
  gctx.fillStyle = color;
  gctx.globalAlpha = alpha;
  gctx.beginPath();
  gctx.moveTo(0, state.height);
  gctx.lineTo(0, baseY);
  for (let x = 0; x <= state.width; x += 60) {
    const peak = baseY - seededRand(rng, amp * 0.4, amp);
    gctx.lineTo(x + 30, peak);
    gctx.lineTo(x + 60, baseY + seededRand(rng, -amp * 0.15, amp * 0.2));
  }
  gctx.lineTo(state.width, state.height);
  gctx.closePath();
  gctx.fill();
  gctx.restore();
}

function buildSoilPattern() {
  const texture = document.createElement("canvas");
  texture.width = 80;
  texture.height = 80;
  const tctx = texture.getContext("2d");
  tctx.fillStyle = "#5b3b2f";
  tctx.fillRect(0, 0, texture.width, texture.height);

  const rng = createRng((state.seed || 1) ^ 0x51f8d4d);
  for (let i = 0; i < 200; i += 1) {
    const x = seededRand(rng, 0, texture.width);
    const y = seededRand(rng, 0, texture.height);
    const r = seededRand(rng, 0.8, 2.2);
    tctx.fillStyle = `rgba(255, 255, 255, ${seededRand(rng, 0.03, 0.1)})`;
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }
  for (let i = 0; i < 120; i += 1) {
    const x = seededRand(rng, 0, texture.width);
    const y = seededRand(rng, 0, texture.height);
    const r = seededRand(rng, 1.2, 3.4);
    tctx.fillStyle = `rgba(40, 20, 16, ${seededRand(rng, 0.15, 0.35)})`;
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }

  visuals.soilPattern = ctx.createPattern(texture, "repeat");
}

function terrainHeightAt(x) {
  const xi = Math.floor(clamp(x, 0, state.width - 1));
  return state.terrain[xi] ?? state.height;
}

function buildTerrain() {
  const w = state.width;
  const h = state.height;
  const rng = createRng(state.seed || 1);
  state.terrain = new Array(Math.floor(w) + 1);

  // --- Random base height ---
  const base = seededRand(rng, h * 0.58, h * 0.75);

  // --- Random sine waves (2-5) for terrain shape ---
  const numWaves = Math.floor(seededRand(rng, 2, 6));
  const waves = [];
  for (let i = 0; i < numWaves; i++) {
    waves.push({
      freq: seededRand(rng, 0.004, 0.045),
      amp: seededRand(rng, h * 0.015, h * 0.12),
      phase: seededRand(rng, 0, Math.PI * 2),
    });
  }

  // --- Overall shape modifier (0=flat, 1=valley, 2=hill, 3=slopeR, 4=slopeL) ---
  const shapeType = Math.floor(rng() * 5);
  const shapeAmp = seededRand(rng, h * 0.06, h * 0.22);

  for (let x = 0; x <= w; x++) {
    let y = base;
    const nx = x / w;

    if (shapeType === 1) {
      y += (1 - 4 * (nx - 0.5) * (nx - 0.5)) * shapeAmp;
    } else if (shapeType === 2) {
      y -= (1 - 4 * (nx - 0.5) * (nx - 0.5)) * shapeAmp;
    } else if (shapeType === 3) {
      y += (nx - 0.5) * shapeAmp;
    } else if (shapeType === 4) {
      y -= (nx - 0.5) * shapeAmp;
    }

    for (const wave of waves) {
      y += Math.sin(x * wave.freq + wave.phase) * wave.amp;
    }
    state.terrain[x] = y;
  }

  // --- Random gaussian bumps / dips ---
  const numBumps = Math.floor(seededRand(rng, 0, 5));
  for (let i = 0; i < numBumps; i++) {
    const cx = seededRand(rng, w * 0.05, w * 0.95);
    const bw = seededRand(rng, 30, 130);
    const bh = seededRand(rng, -h * 0.14, h * 0.14);
    for (let x = 0; x <= w; x++) {
      const dx = (x - cx) / bw;
      if (Math.abs(dx) < 3) {
        state.terrain[x] += Math.exp(-dx * dx) * bh;
      }
    }
  }

  // --- Clamp all ---
  for (let x = 0; x <= w; x++) {
    state.terrain[x] = clamp(state.terrain[x], h * 0.4, h * 0.92);
  }

  // --- Smooth pass to avoid jagged edges ---
  smoothTerrain(3);

  // --- Random extra platforms in center zone (0-2) ---
  const numPlatforms = Math.floor(seededRand(rng, 0, 3));
  for (let i = 0; i < numPlatforms; i++) {
    const px = seededRand(rng, w * 0.35, w * 0.65);
    const pw = seededRand(rng, w * 0.04, w * 0.1);
    const ph = seededRand(rng, h * 0.45, h * 0.72);
    flattenRange(px - pw / 2, px + pw / 2, ph);
  }

  // --- Always flatten spawn areas ---
  const leftAvg = avgTerrainHeight(Math.floor(w * 0.18), Math.floor(w * 0.32));
  const rightAvg = avgTerrainHeight(Math.floor(w * 0.68), Math.floor(w * 0.84));
  flattenRange(w * 0.18, w * 0.32, clamp(leftAvg, h * 0.43, h * 0.78));
  flattenRange(w * 0.68, w * 0.84, clamp(rightAvg, h * 0.43, h * 0.78));

  // --- Generate random map name ---
  state.mapName = generateMapName(rng);
}

function smoothTerrain(passes) {
  for (let p = 0; p < passes; p++) {
    const copy = [...state.terrain];
    for (let x = 1; x < state.terrain.length - 1; x++) {
      state.terrain[x] = (copy[x - 1] + copy[x] + copy[x + 1]) / 3;
    }
  }
}

function generateMapName(rng) {
  const adj = [
    "Salvaje", "Árido", "Olvidado", "Caótico", "Maldito",
    "Perdido", "Bravo", "Oscuro", "Lejano", "Helado",
    "Profundo", "Roto", "Seco", "Turbio", "Feroz",
  ];
  const noun = [
    "Cañón", "Valle", "Desierto", "Páramo", "Abismo",
    "Terreno", "Campo", "Cerro", "Peñasco", "Risco",
    "Barranco", "Cráter", "Paso", "Llano", "Acantilado",
  ];
  return `${noun[Math.floor(rng() * noun.length)]} ${adj[Math.floor(rng() * adj.length)]}`;
}

function avgTerrainHeight(x0, x1) {
  let sum = 0;
  let count = 0;
  for (let x = x0; x <= x1; x++) {
    sum += state.terrain[x];
    count++;
  }
  return count > 0 ? sum / count : state.height * 0.6;
}

function flattenRange(x0, x1, y) {
  const start = Math.floor(clamp(x0, 0, state.width));
  const end = Math.floor(clamp(x1, 0, state.width));
  for (let x = start; x <= end; x += 1) {
    state.terrain[x] = y;
  }
}

function createWorms() {
  const left = [state.width * 0.2, state.width * 0.3];
  const right = [state.width * 0.7, state.width * 0.82];
  const worms = [];

  left.forEach((x, index) => {
    worms.push(makeWorm({
      id: `R${index + 1}`,
      name: `Rojo ${index + 1}`,
      team: "Rojo",
      color: "#ef476f",
      x,
    }));
  });

  right.forEach((x, index) => {
    worms.push(makeWorm({
      id: `A${index + 1}`,
      name: `Azul ${index + 1}`,
      team: "Azul",
      color: "#118ab2",
      x,
    }));
  });

  state.worms = worms;
  state.currentIndex = 0;
}

function makeWorm({ id, name, team, color, x }) {
  const y = terrainHeightAt(x) - config.wormRadius;
  return {
    id,
    name,
    team,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: team === "Rojo" ? 45 : 135,
    health: 100,
    alive: true,
    onGround: true,
  };
}

function resetGame(seedOverride) {
  if (Number.isFinite(seedOverride)) {
    state.seed = Math.floor(seedOverride);
  }
  if (!state.seed) {
    state.seed = Math.floor(Math.random() * 1e9);
  }
  state.gameOver = false;
  state.winner = null;
  state.projectiles = [];
  state.charge = 0;
  state.charging = false;
  state.weaponIndex = 0;
  state.aiTimer = 0;
  state.aiPlan = null;
  state.turnTimer = state.turnTimerMax;
  state.healthPacks = [];
  state.packSpawnTimer = 20 + Math.random() * 10;
  buildTerrain();
  createWorms();
  updateHud();
  state.wind = Math.floor(rand(-5, 5));
  initClouds();
  const worm = state.worms[state.currentIndex];
  if (worm) {
    sayComment("turn", { name: `${worm.name} — Mapa: ${state.mapName}` });
  }
}

function resize(width, height) {
  if (!canvas || !ctx) return;
  state.dpr = 1;
  const nextWidth = Math.floor(width);
  const nextHeight = Math.floor(height);
  if (!net.enabled || !state.width || !state.height) {
    state.width = nextWidth;
    state.height = nextHeight;
  }
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  canvas.style.width = `${nextWidth}px`;
  canvas.style.height = `${nextHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (isMobile) updateTouchLayout();
  if (!net.enabled) {
    resetGame();
  }
}

function updateHud() {
  // HUD is now drawn on canvas each frame
}

function getCurrentWeapon() {
  return weapons[state.weaponIndex] ?? weapons[0];
}

function setWeapon(index) {
  if (state.projectiles.length > 0 || state.charging || state.gameOver) return;
  const next = (index + weapons.length) % weapons.length;
  state.weaponIndex = next;
  updateHud();
}

function sayComment(type, extra = {}) {
  const list = commentary[type] || commentary.fire;
  let text = list[Math.floor(Math.random() * list.length)];
  if (extra.name) text = text.replaceAll("{name}", extra.name);
  if (extra.weapon) text = text.replaceAll("{weapon}", extra.weapon);
  commentaryState.text = text;
  commentaryState.timer = commentaryState.duration;
  commentaryState.popTimer = 0.35;
}

function spawnHealthPack() {
  const pack = {
    x: state.width * (0.1 + Math.random() * 0.8),
    y: -40,
    fallSpeed: 40 + Math.random() * 20,
    healAmount: Math.floor(5 + Math.random() * 16),
    swayPhase: Math.random() * Math.PI * 2,
    age: 0,
    grounded: false,
    groundTimer: 0,
    alive: true,
  };
  state.healthPacks.push(pack);
}

function updateHealthPacks(dt) {
  for (const pack of state.healthPacks) {
    if (!pack.alive) continue;
    pack.age += dt;

    if (!pack.grounded) {
      pack.y += pack.fallSpeed * dt;
      pack.x += Math.sin(pack.age * 2.5 + pack.swayPhase) * 15 * dt;
      pack.x += getEffectiveWind() * 12 * dt;
      pack.x = clamp(pack.x, 5, state.width - 5);
      const groundY = terrainHeightAt(pack.x);
      if (pack.y >= groundY - 12) {
        pack.y = groundY - 12;
        pack.grounded = true;
        pack.groundTimer = 0;
      }
    } else {
      const groundY = terrainHeightAt(pack.x);
      if (pack.y < groundY - 14) {
        pack.grounded = false;
        pack.fallSpeed = 120;
      } else {
        pack.y = groundY - 12;
        pack.groundTimer += dt;
        if (pack.groundTimer > 12) {
          pack.alive = false;
          continue;
        }
      }
    }

    for (const worm of state.worms) {
      if (!worm.alive) continue;
      const dx = worm.x - pack.x;
      const dy = worm.y - pack.y;
      if (Math.sqrt(dx * dx + dy * dy) < 25) {
        worm.health = Math.min(100, worm.health + pack.healAmount);
        pack.alive = false;
        sayComment("heal");
        break;
      }
    }
  }
  state.healthPacks = state.healthPacks.filter((p) => p.alive);
}

function drawHealthPack(pack) {
  const boxW = 14;
  const boxH = 12;
  const domeW = 28;
  const domeH = 16;
  const ropeLen = 20;

  ctx.save();
  ctx.translate(pack.x, pack.y);

  if (!pack.grounded) {
    const sway = Math.sin(pack.age * 2.5 + pack.swayPhase) * 0.12;
    ctx.rotate(sway);

    const domeBaseY = -boxH / 2 - ropeLen;
    const domeTopY = domeBaseY - domeH;

    // Dome canopy — puffy shape with segments
    const segCount = 8;
    for (let i = 0; i < segCount; i++) {
      const t0 = i / segCount;
      const t1 = (i + 1) / segCount;
      const x0 = -domeW / 2 + t0 * domeW;
      const x1 = -domeW / 2 + t1 * domeW;
      const midX = (x0 + x1) / 2;
      // Parabolic top edge: higher in the center, lower at edges
      const normMid = (midX / (domeW / 2));
      const bulge = (1 - normMid * normMid) * domeH;
      const topY = domeBaseY - bulge;
      // Extra puffiness per segment
      const segBulge = bulge * 0.25;

      ctx.beginPath();
      ctx.moveTo(x0, domeBaseY);
      ctx.quadraticCurveTo(midX, topY - segBulge, x1, domeBaseY);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? "#e74c3c" : "#fff";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Dome outline
    ctx.beginPath();
    ctx.moveTo(-domeW / 2, domeBaseY);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const px = -domeW / 2 + t * domeW;
      const norm = (px / (domeW / 2));
      const py = domeBaseY - (1 - norm * norm) * domeH;
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ropes — 4 lines from dome edge to box corners
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 0.8;
    const ropeAnchors = [-1, -0.35, 0.35, 1];
    const boxAnchors = [-boxW / 2, -boxW / 4, boxW / 4, boxW / 2];
    for (let i = 0; i < 4; i++) {
      const ax = ropeAnchors[i] * (domeW / 2);
      ctx.beginPath();
      ctx.moveTo(ax, domeBaseY);
      ctx.lineTo(boxAnchors[i], -boxH / 2);
      ctx.stroke();
    }
  }

  // Blink when close to timeout
  const blink = pack.grounded && pack.groundTimer > 9;
  if (blink && Math.floor(pack.groundTimer * 4) % 2 === 0) {
    ctx.restore();
    return;
  }

  // Box
  ctx.fillStyle = "#f0f0f0";
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 1.5;
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // Red cross
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(-1.5, -boxH / 2 + 2, 3, boxH - 4);
  ctx.fillRect(-boxW / 2 + 2, -1.5, boxW - 4, 3);

  // Heal text
  ctx.fillStyle = "#06d6a0";
  ctx.font = "bold 10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(`+${pack.healAmount}`, 0, -boxH / 2 - 4);

  ctx.restore();
}

function drawHealthPacks() {
  for (const pack of state.healthPacks) {
    drawHealthPack(pack);
  }
}

function getActiveTeam() {
  const worm = state.worms[state.currentIndex];
  return worm?.team ?? null;
}

function canApplyInput(sourceTeam = null) {
  const activeTeam = getActiveTeam();
  if (!activeTeam) return false;
  if (!net.enabled) return true;
  if (sourceTeam) return sourceTeam === activeTeam;
  if (net.team) return net.team === activeTeam;
  return false;
}

function sendNet(msg) {
  if (!net.enabled || !net.connected || !net.ws) return;
  net.ws.send(JSON.stringify(msg));
}

function handleNetMessage(msg) {
  if (!msg || typeof msg.type !== "string") return;
  if (msg.type === "welcome") {
    net.playerId = msg.id;
    net.team = msg.team;
    state.seed = msg.seed ?? state.seed;
    aiConfig.enabled = false;
    net.prevState = null;
    net.currState = null;
    if (msg.state) {
      applyState(msg.state);
    }
    return;
  }
  if (msg.type === "reset") {
    net.prevState = null;
    net.currState = null;
    if (msg.state) {
      applySnapshotToState(msg.state);
    }
    state.explosions = [];
    updateHud();
    return;
  }
  if (msg.type === "crater") {
    if (Number.isFinite(msg.x) && Number.isFinite(msg.y) && Number.isFinite(msg.radius)) {
      carveCrater(msg.x, msg.y, msg.radius);
      spawnExplosion(msg.x, msg.y, msg.radius);
    }
    return;
  }
  if (msg.type === "state") {
    applyState(msg.state);
  }
  if (msg.type === "players") {
    if (msg.players && msg.players.length >= 2) {
      document.getElementById("menu-overlay").classList.add("hidden");
    }
  }
}

function applyState(snapshot) {
  if (!snapshot) return;
  if (net.enabled) {
    const now = performance.now();
    if (net.currState) {
      net.prevState = net.currState;
      const delta = now - net.lastReceived;
      if (delta > 5) net.intervalMs = delta;
    }
    net.currState = snapshot;
    net.lastReceived = now;
  }
  applySnapshotToState(snapshot);
}

function applySnapshotToState(snapshot) {
  state.width = snapshot.width;
  state.height = snapshot.height;
  state.seed = snapshot.seed ?? state.seed;
  if (snapshot.terrain) {
    state.terrain = snapshot.terrain;
  }
  if (snapshot.worms) {
    state.worms = snapshot.worms.map((worm) => ({ ...worm }));
  }
  state.currentIndex = snapshot.currentIndex ?? state.currentIndex;
  state.weaponIndex = snapshot.weaponIndex ?? state.weaponIndex;
  if (snapshot.projectiles) {
    state.projectiles = snapshot.projectiles.map((p) => ({ ...p }));
  } else if (!net.enabled) {
    state.projectiles = [];
  }
  state.charging = snapshot.charging ?? false;
  state.charge = snapshot.charge ?? 0;
  state.gameOver = snapshot.gameOver ?? false;
  state.winner = snapshot.winner ?? null;
  state.wind = snapshot.wind ?? 0;
  state.turnTimer = snapshot.turnTimer ?? state.turnTimer;
  state.turnTimerMax = snapshot.turnTimerMax ?? state.turnTimerMax;
  updateHud();
}

function applyInterpolatedState() {
  if (!net.enabled || !net.currState) return;
  const prev = net.prevState || net.currState;
  const now = performance.now();
  const alpha = clamp((now - net.lastReceived) / (net.intervalMs || 33), 0, 1);

  if (net.currState.worms) {
    state.worms = net.currState.worms.map((worm, index) => {
      const prevWorm = prev.worms?.[index] || worm;
      return {
        ...worm,
        x: lerp(prevWorm.x, worm.x, alpha),
        y: lerp(prevWorm.y, worm.y, alpha),
        angle: lerp(prevWorm.angle ?? worm.angle, worm.angle, alpha),
      };
    });
  }

  if (net.currState.projectiles) {
    state.projectiles = net.currState.projectiles.map((proj, index) => {
      const prevProj = prev.projectiles?.[index] || proj;
      return {
        ...proj,
        x: lerp(prevProj.x, proj.x, alpha),
        y: lerp(prevProj.y, proj.y, alpha),
      };
    });
  }
}

function connectNet() {
  if (!net.enabled) return;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  net.url = `${protocol}://${host}`;
  aiConfig.enabled = false;
  try {
    net.ws = new WebSocket(net.url);
  } catch (err) {
    console.warn("No se pudo conectar al servidor WS", err);
    return;
  }
  net.ws.addEventListener("open", () => {
    net.connected = true;
    sendNet({ type: "join" });
  });
  net.ws.addEventListener("close", () => {
    net.connected = false;
  });
  net.ws.addEventListener("message", (event) => {
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    handleNetMessage(msg);
  });
}

function evaluateShotFromPosition(px, py, targets) {
  const weapon = weapons[0];
  const target = targets.reduce((closest, current) => {
    return Math.abs(current.x - px) < Math.abs(closest.x - px) ? current : closest;
  }, targets[0]);

  const towardRight = target.x >= px;
  const angleStart = towardRight ? 15 : 100;
  const angleEnd = towardRight ? 80 : 165;
  let best = Infinity;

  for (let angle = angleStart; angle <= angleEnd; angle += aiConfig.angleStep * 2) {
    for (let power = aiConfig.powerMin; power <= aiConfig.powerMax; power += aiConfig.powerStep * 2) {
      const score = simulateShot(px, py, angle, power, weapon, targets);
      if (score < best) best = score;
    }
  }
  return best;
}

function planAIMove(worm) {
  const targets = state.worms.filter((w) => w.alive && w.team !== worm.team);
  if (targets.length === 0) return worm.x;

  const bounds = getMoveBounds(worm.team);
  const usableMin = bounds.min + 20;
  const usableMax = bounds.max - 20;
  const candidates = [worm.x];

  const numSamples = 5;
  const step = (usableMax - usableMin) / numSamples;
  for (let i = 0; i <= numSamples; i++) {
    candidates.push(usableMin + step * i);
  }
  for (const offset of [-40, -80, 40, 80]) {
    candidates.push(clamp(worm.x + offset, usableMin, usableMax));
  }

  let bestX = worm.x;
  let bestScore = Infinity;

  for (const cx of candidates) {
    if (wouldCollideWithWorm(worm, cx)) continue;
    const cy = terrainHeightAt(cx) - config.wormRadius;
    const shotScore = evaluateShotFromPosition(cx, cy, targets);
    const heightBonus = (cy / state.height) * 5;
    const total = shotScore + heightBonus;
    if (total < bestScore) {
      bestScore = total;
      bestX = cx;
    }
  }

  return bestX;
}

function updateAI(dt) {
  if (!aiConfig.enabled || state.gameOver || state.projectiles.length > 0 || state.charging) return;
  const worm = state.worms[state.currentIndex];
  if (!worm || !worm.alive || worm.team !== aiConfig.team) return;

  if (!state.aiPlan) {
    const targetX = planAIMove(worm);
    const shouldMove = Math.abs(targetX - worm.x) > 10;
    state.aiPlan = {
      phase: shouldMove ? "moving" : "thinking",
      targetX,
      moveTime: 0,
      angle: 0,
      power: 0,
      weaponIndex: 0,
    };
    state.aiTimer = rand(0.2, 0.5);
    updateHud();
    return;
  }

  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;

  if (state.aiPlan.phase === "moving") {
    const diff = state.aiPlan.targetX - worm.x;
    state.aiPlan.moveTime += dt;
    if (Math.abs(diff) > 5 && state.aiPlan.moveTime < aiConfig.moveTimeMax) {
      const dir = diff > 0 ? 1 : -1;
      const aiBounds = getMoveBounds(worm.team);
      const newX = clamp(worm.x + dir * config.moveSpeed * dt, aiBounds.min, aiBounds.max);
      if (!wouldCollideWithWorm(worm, newX)) {
        worm.x = newX;
      } else {
        state.aiPlan.phase = "thinking";
        state.aiTimer = rand(aiConfig.thinkDelayMin, aiConfig.thinkDelayMax);
      }
    } else {
      state.aiPlan.phase = "thinking";
      state.aiTimer = rand(aiConfig.thinkDelayMin, aiConfig.thinkDelayMax);
    }
    return;
  }

  if (state.aiPlan.phase === "thinking") {
    const shot = planShot(worm);
    state.aiPlan.angle = shot.angle;
    state.aiPlan.power = shot.power;
    state.aiPlan.weaponIndex = shot.weaponIndex;
    state.aiPlan.phase = "firing";
    state.aiTimer = rand(0.3, 0.6);
    return;
  }

  if (state.aiPlan.phase === "firing") {
    setWeapon(state.aiPlan.weaponIndex);
    worm.angle = state.aiPlan.angle;
    const weapon = getCurrentWeapon();
    fireProjectile(worm, state.aiPlan.power, weapon);
    state.aiPlan = null;
    state.aiTimer = 0;
    updateHud();
  }
}

function planShot(worm) {
  const targets = state.worms.filter((w) => w.alive && w.team !== worm.team);
  if (targets.length === 0) {
    return { angle: worm.team === "Rojo" ? 60 : 120, power: 0.6, weaponIndex: 0 };
  }

  let best = { score: Infinity, angle: worm.angle, power: 0.6, weaponIndex: 0 };
  const startX = worm.x;
  const startY = worm.y;
  const target = targets.reduce((closest, current) => {
    const d1 = Math.abs(current.x - worm.x);
    const d2 = Math.abs(closest.x - worm.x);
    return d1 < d2 ? current : closest;
  }, targets[0]);

  const towardRight = target.x >= worm.x;
  const angleStart = towardRight ? 15 : 100;
  const angleEnd = towardRight ? 80 : 165;

  for (let wi = 0; wi < weapons.length; wi++) {
    const weapon = weapons[wi];
    for (let angle = angleStart; angle <= angleEnd; angle += aiConfig.angleStep) {
      for (let power = aiConfig.powerMin; power <= aiConfig.powerMax; power += aiConfig.powerStep) {
        const score = simulateShot(startX, startY, angle, power, weapon, targets);
        if (score < best.score) {
          best = { score, angle, power, weaponIndex: wi };
        }
      }
    }
  }

  return best;
}

function simulateShot(startX, startY, angle, power, weapon, targets) {
  const rad = (angle * Math.PI) / 180;
  const speed = weapon.minSpeed + (weapon.maxSpeed - weapon.minSpeed) * power;
  let x = startX + Math.cos(rad) * (config.wormRadius + 6);
  let y = startY - Math.sin(rad) * (config.wormRadius + 6);
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;
  let minDist = Infinity;
  const gravity = config.gravity * weapon.gravityScale;
  const blastR = weapon.explosionRadius || 40;

  for (let t = 0; t < aiConfig.simMaxTime; t += aiConfig.simStep) {
    vx += getEffectiveWind() * WIND_SCALE * aiConfig.simStep;
    vy += gravity * aiConfig.simStep;
    x += vx * aiConfig.simStep;
    y += vy * aiConfig.simStep;

    if (x < -200 || x > state.width + 200 || y > state.height + 200) break;

    for (const target of targets) {
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
    }

    const hitTerrain = y >= terrainHeightAt(x);
    const hitDirect = minDist <= config.wormRadius + 6;
    if (hitTerrain || hitDirect) break;
  }

  // Score considers explosion radius: if minDist is within blast range, reward it
  if (minDist <= blastR) {
    const falloff = 1 - minDist / blastR;
    const estimatedDmg = falloff * (weapon.maxDamage || 50);
    // Lower score = better; negate damage so higher damage = lower score
    return -estimatedDmg;
  }

  return minDist;
}

function nextTurn() {
  const alive = state.worms.filter((worm) => worm.alive);
  const teams = new Set(alive.map((worm) => worm.team));
  if (teams.size <= 1) {
    state.gameOver = true;
    state.winner = alive[0]?.team ?? "Nadie";
    updateHud();
    return;
  }

  let idx = state.currentIndex;
  for (let i = 0; i < state.worms.length; i += 1) {
    idx = (idx + 1) % state.worms.length;
    if (state.worms[idx].alive) {
      state.currentIndex = idx;
      break;
    }
  }

  const worm = state.worms[state.currentIndex];
  worm.angle = worm.team === "Rojo" ? 45 : 135;
  state.charge = 0;
  state.turnTimer = state.turnTimerMax;
  updateHud();
  sayComment("turn", { name: worm.name });
}

function getMoveBounds(team) {
  const half = state.width * 0.5;
  if (team === "Rojo") return { min: config.wormRadius, max: half };
  if (team === "Azul") return { min: half, max: state.width - config.wormRadius };
  return { min: config.wormRadius, max: state.width - config.wormRadius };
}

function wouldCollideWithWorm(worm, newX) {
  for (const other of state.worms) {
    if (other === worm || !other.alive) continue;
    if (Math.abs(newX - other.x) < config.minWormDistance) return true;
  }
  return false;
}

function updateWorm(worm, dt, isActive) {
  if (!worm.alive) return;

  if (isActive && state.projectiles.length === 0) {
    const left = keys.has("ArrowLeft");
    const right = keys.has("ArrowRight");
    const up = keys.has("ArrowUp");
    const down = keys.has("ArrowDown");

    if (left !== right) {
      const dir = left ? -1 : 1;
      const bounds = getMoveBounds(worm.team);
      const newX = clamp(worm.x + dir * config.moveSpeed * dt, bounds.min, bounds.max);
      if (!wouldCollideWithWorm(worm, newX)) {
        worm.x = newX;
      }
    }

    if (up !== down) {
      const dir = up ? 1 : -1;
      worm.angle += dir * config.angleSpeed * dt;
      const bounds = getAimBounds(worm.team);
      worm.angle = clamp(worm.angle, bounds.min, bounds.max);
    }
  }

  if (!worm.onGround || Math.abs(worm.vx) > 1) {
    worm.x += worm.vx * dt;
    worm.x = clamp(worm.x, config.wormRadius, state.width - config.wormRadius);
    worm.vx *= worm.onGround ? 0.8 : 0.99;
  }

  const ground = terrainHeightAt(worm.x) - config.wormRadius;
  if (worm.y < ground - 1) {
    worm.onGround = false;
  }

  if (!worm.onGround) {
    worm.vy += config.gravity * dt;
    worm.y += worm.vy * dt;
  }

  const groundY = terrainHeightAt(worm.x) - config.wormRadius;
  if (worm.y >= groundY) {
    worm.y = groundY;
    worm.vy = 0;
    worm.onGround = true;
  }
}

function addProjectile(params) {
  state.projectiles.push(params);
}

function fireProjectile(worm, power, weapon) {
  const burst = weapon.burst ?? 1;
  const spread = weapon.burstSpread ?? 0;
  const jitter = weapon.burstSpeedJitter ?? 0;
  const baseSpeed = weapon.minSpeed + (weapon.maxSpeed - weapon.minSpeed) * power;
  const muzzle = config.wormRadius + 6;
  const centerAngle = worm.angle;

  sayComment("fire", { weapon: weapon.name });

  for (let i = 0; i < burst; i += 1) {
    const offset = burst === 1 ? 0 : (i - (burst - 1) / 2) * spread;
    const rad = ((centerAngle + offset) * Math.PI) / 180;
    const speed = baseSpeed * (1 + rand(-jitter, jitter));
    const startX = worm.x + Math.cos(rad) * muzzle;
    const startY = worm.y - Math.sin(rad) * muzzle;

    addProjectile({
      x: startX,
      y: startY,
      vx: Math.cos(rad) * speed,
      vy: -Math.sin(rad) * speed,
      radius: weapon.projectileRadius ?? 4,
      weaponId: weapon.id,
      explosionRadius: weapon.explosionRadius,
      maxDamage: weapon.maxDamage,
      bounciness: weapon.bounciness,
      fuse: weapon.fuse,
      timer: weapon.fuse,
      gravity: config.gravity * weapon.gravityScale,
      bounces: 0,
      alive: true,
    });
  }
}

function updateProjectiles(dt) {
  if (state.projectiles.length === 0) return;
  const next = [];

  state.projectiles.forEach((p) => {
    p.vx += getEffectiveWind() * WIND_SCALE * dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.timer > 0) {
      p.timer -= dt;
      if (p.timer <= 0) {
        explode(p.x, p.y, p.explosionRadius, p.maxDamage);
        return;
      }
    }

    if (p.x < -200 || p.x > state.width + 200 || p.y > state.height + 200) {
      return;
    }

    if (p.y >= terrainHeightAt(p.x)) {
      if (p.bounciness > 0 && p.bounces < 3 && p.timer > 0.05) {
        p.y = terrainHeightAt(p.x) - 2;
        p.vy = -Math.abs(p.vy) * p.bounciness;
        p.vx *= 0.8;
        p.bounces += 1;
      } else {
        explode(p.x, p.y, p.explosionRadius, p.maxDamage);
        return;
      }
    }

    next.push(p);
  });

  state.projectiles = next;
  if (state.projectiles.length === 0) {
    nextTurn();
  }
}

function explode(x, y, radius, maxDamage) {
  carveCrater(x, y, radius);
  spawnExplosion(x, y, radius);

  let gotHit = false;
  let gotKill = false;
  state.worms.forEach((worm) => {
    if (!worm.alive) return;
    const dx = worm.x - x;
    const dy = worm.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) return;

    const falloff = 1 - dist / radius;
    const damage = Math.round(falloff * maxDamage);
    worm.health -= damage;
    gotHit = true;
    if (worm.health <= 0) {
      worm.alive = false;
      gotKill = true;
      return;
    }

    const knock = 260 * falloff;
    const angle = Math.atan2(dy, dx);
    worm.vx += Math.cos(angle) * knock;
    worm.vy += Math.sin(angle) * knock - 200 * falloff;
    worm.onGround = false;
  });

  if (gotKill) {
    sayComment("kill");
  } else if (gotHit) {
    sayComment("hit");
  } else {
    sayComment("boom");
  }
}

function carveCrater(cx, cy, radius) {
  const start = Math.floor(clamp(cx - radius, 0, state.width));
  const end = Math.floor(clamp(cx + radius, 0, state.width));
  for (let x = start; x <= end; x += 1) {
    const dx = x - cx;
    const span = Math.sqrt(Math.max(0, radius * radius - dx * dx));
    const craterY = cy + span;
    if (state.terrain[x] < craterY) {
      state.terrain[x] = craterY;
    }
  }
}

function spawnExplosion(x, y, radius) {
  const particles = [];
  const count = 20;
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(radius * 1.5, radius * 3.2);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.3, 0.6),
      age: 0,
      size: rand(2, 4),
    });
  }

  state.explosions.push({
    x,
    y,
    radius,
    life: 0,
    duration: 0.5,
    particles,
  });
}

function updateExplosions(dt) {
  if (state.explosions.length === 0) return;
  state.explosions = state.explosions.filter((boom) => {
    boom.life += dt;
    const activeParticles = [];
    boom.particles.forEach((p) => {
      p.age += dt;
      if (p.age >= p.life) return;
      p.vy += config.gravity * 0.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      activeParticles.push(p);
    });
    boom.particles = activeParticles;
    return boom.life < boom.duration || boom.particles.length > 0;
  });
}

function drawBackground() {
  ensureVisuals();
  if (visuals.bgCanvas) {
    ctx.drawImage(visuals.bgCanvas, 0, 0, state.width, state.height);
  }
}

function drawTerrain() {
  const terrainPath = buildTerrainPath();
  const edgePath = buildTerrainEdgePath();

  ctx.save();
  ctx.fillStyle = "#6a4a39";
  ctx.fill(terrainPath);

  ctx.clip(terrainPath);
  const soilGrad = ctx.createLinearGradient(0, state.height * 0.35, 0, state.height);
  soilGrad.addColorStop(0, "rgba(120, 86, 66, 0.6)");
  soilGrad.addColorStop(1, "rgba(60, 35, 25, 0.9)");
  ctx.fillStyle = soilGrad;
  ctx.fillRect(0, 0, state.width, state.height);

  if (visuals.soilPattern) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = visuals.soilPattern;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#2b7d3d";
  ctx.lineWidth = 8;
  ctx.stroke(edgePath);

  ctx.strokeStyle = "#5fd17a";
  ctx.lineWidth = 3;
  ctx.stroke(edgePath);
}

function buildTerrainPath() {
  const path = new Path2D();
  path.moveTo(0, state.height);
  path.lineTo(0, state.terrain[0]);
  for (let x = 1; x < state.terrain.length; x += 1) {
    path.lineTo(x, state.terrain[x]);
  }
  path.lineTo(state.width, state.height);
  path.closePath();
  return path;
}

function buildTerrainEdgePath() {
  const path = new Path2D();
  path.moveTo(0, state.terrain[0]);
  for (let x = 1; x < state.terrain.length; x += 1) {
    path.lineTo(x, state.terrain[x]);
  }
  return path;
}

function drawTrajectory() {
  if (state.gameOver || state.projectiles.length > 0) return;
  if (!state.charging || state.charge <= 0) return;

  const worm = state.worms[state.currentIndex];
  if (!worm || !worm.alive) return;
  const weapon = getCurrentWeapon();
  const power = clamp(state.charge, 0, 1);

  const rad = (worm.angle * Math.PI) / 180;
  const speed = weapon.minSpeed + (weapon.maxSpeed - weapon.minSpeed) * power;
  const muzzle = config.wormRadius + 6;
  let x = worm.x + Math.cos(rad) * muzzle;
  let y = worm.y - Math.sin(rad) * muzzle;
  let vx = Math.cos(rad) * speed;
  let vy = -Math.sin(rad) * speed;
  const gravity = config.gravity * weapon.gravityScale;

  ctx.save();
  ctx.fillStyle = "rgba(20, 22, 28, 0.85)";
  ctx.strokeStyle = "rgba(20, 22, 28, 0.6)";
  ctx.lineWidth = 1;

  let hitX = null;
  let hitY = null;
  const step = 0.06;
  const maxTime = 2.6;
  for (let t = 0; t < maxTime; t += step) {
    vx += getEffectiveWind() * WIND_SCALE * step;
    vy += gravity * step;
    x += vx * step;
    y += vy * step;

    if (x < -100 || x > state.width + 100 || y > state.height + 200) break;
    if (y >= terrainHeightAt(x)) {
      hitX = x;
      hitY = terrainHeightAt(x);
      break;
    }

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hitX !== null && hitY !== null) {
    ctx.strokeStyle = "rgba(255, 74, 110, 0.9)";
    ctx.beginPath();
    ctx.arc(hitX, hitY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWeaponIcon(weaponId, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (weaponId === "bazooka") {
    // Tube body
    ctx.fillStyle = "#556B2F";
    ctx.fillRect(-14, -3, 28, 6);
    // Muzzle (wider front)
    ctx.fillStyle = "#666";
    ctx.fillRect(14, -4.5, 5, 9);
    // Rear grip
    ctx.fillStyle = "#3d4f22";
    ctx.fillRect(-14, -2, 4, 8);
    // Highlight stripe
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(-10, -3, 20, 2);
  } else if (weaponId === "grenade") {
    // Body
    ctx.fillStyle = "#2d5a27";
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(-2, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    // Cap
    ctx.fillStyle = "#444";
    ctx.fillRect(-2.5, -6, 5, 4);
    // Fuse
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(4, -10, 6, -8);
    ctx.stroke();
    // Spark
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(6, -8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFA500";
    ctx.beginPath();
    ctx.arc(6, -8, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (weaponId === "mortar") {
    // Base
    ctx.fillStyle = "#555";
    ctx.fillRect(-8, 4, 16, 4);
    // Barrel (thick short tube)
    ctx.fillStyle = "#444";
    ctx.fillRect(-5, -8, 10, 14);
    // Bore opening
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.ellipse(0, -8, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Metal highlight
    ctx.fillStyle = "#777";
    ctx.fillRect(-5, -4, 3, 10);
  } else if (weaponId === "sniper") {
    // Barrel (long thin)
    ctx.fillStyle = "#222";
    ctx.fillRect(-16, -1.5, 32, 3);
    // Stock
    ctx.fillStyle = "#6B3A2A";
    ctx.beginPath();
    ctx.moveTo(-16, -2.5);
    ctx.lineTo(-16, 4);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-10, -2.5);
    ctx.closePath();
    ctx.fill();
    // Scope mount
    ctx.fillStyle = "#333";
    ctx.fillRect(2, -5, 8, 3);
    // Scope lens
    ctx.fillStyle = "#446";
    ctx.beginPath();
    ctx.arc(10, -3.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Scope lens glint
    ctx.fillStyle = "rgba(150,180,255,0.4)";
    ctx.beginPath();
    ctx.arc(9.5, -4, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (weaponId === "pistol") {
    // Barrel
    ctx.fillStyle = "#555";
    ctx.fillRect(-4, -2, 14, 4);
    // Slide top
    ctx.fillStyle = "#444";
    ctx.fillRect(-4, -3, 14, 2);
    // Grip
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(-4, 9);
    ctx.lineTo(2, 9);
    ctx.lineTo(4, 2);
    ctx.closePath();
    ctx.fill();
    // Trigger guard
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(2, 4, 3, 0, Math.PI);
    ctx.stroke();
    // Muzzle
    ctx.fillStyle = "#333";
    ctx.fillRect(10, -1.5, 2, 3);
  }

  ctx.restore();
}

function drawWormWeapon(worm, rad, weaponId) {
  ctx.save();
  ctx.translate(worm.x, worm.y);
  ctx.rotate(-rad);

  const armLen = 36;

  if (weaponId === "bazooka") {
    // Tube
    ctx.fillStyle = "#556B2F";
    ctx.fillRect(6, -3, 26, 6);
    ctx.fillStyle = "#666";
    ctx.fillRect(32, -4, 4, 8);
    ctx.fillStyle = "#3d4f22";
    ctx.fillRect(6, -2, 3, 7);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(10, -3, 18, 2);
  } else if (weaponId === "grenade") {
    // Arm holding grenade
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(20, 0);
    ctx.stroke();
    // Body
    ctx.fillStyle = "#2d5a27";
    ctx.beginPath();
    ctx.arc(24, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(22, -1.5, 2, 0, Math.PI * 2);
    ctx.fill();
    // Cap + fuse
    ctx.fillStyle = "#444";
    ctx.fillRect(22, -7, 4, 3);
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(24, -7);
    ctx.quadraticCurveTo(28, -10, 30, -8);
    ctx.stroke();
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(30, -8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (weaponId === "mortar") {
    // Thick short barrel
    ctx.fillStyle = "#444";
    ctx.fillRect(6, -5, 22, 10);
    // Bore
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.ellipse(28, 0, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Metal highlight
    ctx.fillStyle = "#777";
    ctx.fillRect(6, -5, 3, 10);
    // Base bracket
    ctx.fillStyle = "#555";
    ctx.fillRect(6, 3, 16, 3);
  } else if (weaponId === "sniper") {
    // Long barrel
    ctx.fillStyle = "#222";
    ctx.fillRect(6, -1.5, 30, 3);
    // Stock
    ctx.fillStyle = "#6B3A2A";
    ctx.beginPath();
    ctx.moveTo(6, -2.5);
    ctx.lineTo(6, 4);
    ctx.lineTo(12, 2);
    ctx.lineTo(12, -2.5);
    ctx.closePath();
    ctx.fill();
    // Scope
    ctx.fillStyle = "#333";
    ctx.fillRect(20, -5, 8, 3);
    ctx.fillStyle = "#446";
    ctx.beginPath();
    ctx.arc(28, -3.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,180,255,0.35)";
    ctx.beginPath();
    ctx.arc(27.5, -4, 0.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (weaponId === "pistol") {
    // Barrel
    ctx.fillStyle = "#555";
    ctx.fillRect(8, -2, 14, 4);
    ctx.fillStyle = "#444";
    ctx.fillRect(8, -3, 14, 2);
    // Grip
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(8, 8);
    ctx.lineTo(14, 8);
    ctx.lineTo(16, 2);
    ctx.closePath();
    ctx.fill();
    // Muzzle
    ctx.fillStyle = "#333";
    ctx.fillRect(22, -1.5, 2, 3);
  }

  // Aim dot at tip
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(armLen, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWorm(worm, isCurrent) {
  if (!worm.alive) return;
  const r = config.wormRadius;
  const rad = (worm.angle * Math.PI) / 180;
  const facingRight = Math.cos(rad) >= 0;
  const fd = facingRight ? 1 : -1;
  const isRojo = worm.team === "Rojo";

  // --- Shadow (more pronounced) ---
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(worm.x, worm.y + r + 4, r * 0.95, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Boots (2 small rounded rects at the base) ---
  const bootW = 6, bootH = 5, bootGap = 3;
  const bootY = worm.y + r * 0.95;
  for (let side = -1; side <= 1; side += 2) {
    const bx = worm.x + side * bootGap - bootW / 2;
    // Sole (darker)
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.roundRect(bx, bootY + bootH - 2, bootW, 2.5, 1);
    ctx.fill();
    // Boot body
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.roundRect(bx, bootY, bootW, bootH, [2, 2, 1, 1]);
    ctx.fill();
    // Boot outline
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, bootY, bootW, bootH + 0.5, [2, 2, 1, 1]);
    ctx.stroke();
  }

  // --- Body (chunky ellipse with thick cartoon outline) ---
  const bodyW = r * 1.0;
  const bodyH = r * 1.2;
  const bodyGrad = ctx.createRadialGradient(
    worm.x + fd * 3, worm.y - 6, 2,
    worm.x, worm.y, r * 1.25
  );
  bodyGrad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  bodyGrad.addColorStop(0.35, worm.color);
  bodyGrad.addColorStop(1, isRojo ? "#a82040" : "#0a6a8f");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(worm.x, worm.y, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thick cartoon outline
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(worm.x, worm.y, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Belly highlight (more visible)
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.ellipse(worm.x + fd * 1.5, worm.y + 4, r * 0.55, r * 0.32, 0.1 * fd, 0, Math.PI * 2);
  ctx.fill();

  // --- Military Helmet ---
  const helmetColor = isRojo ? "#a93226" : "#1a5276";
  const helmetRim = isRojo ? "#7b241c" : "#113d5a";
  const helmetY = worm.y - bodyH * 0.55;
  const helmetW = r * 0.85;
  const helmetH = r * 0.55;

  // Helmet dome (squashed semicircle)
  ctx.fillStyle = helmetColor;
  ctx.beginPath();
  ctx.ellipse(worm.x, helmetY, helmetW, helmetH, 0, Math.PI, 0);
  ctx.fill();

  // Helmet rim (thicker band at the base)
  ctx.fillStyle = helmetRim;
  ctx.beginPath();
  ctx.ellipse(worm.x, helmetY, helmetW * 1.08, 3.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = helmetRim;
  ctx.fillRect(worm.x - helmetW * 1.08, helmetY - 3.5, helmetW * 2.16, 4);

  // Helmet outline
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(worm.x, helmetY, helmetW, helmetH, 0, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(worm.x - helmetW * 1.08, helmetY);
  ctx.lineTo(worm.x + helmetW * 1.08, helmetY);
  ctx.stroke();

  // Helmet shine/highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.ellipse(worm.x - helmetW * 0.25, helmetY - helmetH * 0.4, helmetW * 0.3, helmetH * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // --- Eyes (big, expressive) ---
  const eyeCenterX = worm.x + fd * 4;
  const eyeY = worm.y - 2;
  const eyeGap = 4;
  const eye1x = eyeCenterX - eyeGap * fd;
  const eye2x = eyeCenterX + eyeGap * fd;
  const eyeRx = 4, eyeRy = 4.8;

  // Eye whites
  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.ellipse(eye1x, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eye2x, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye outlines
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(eye1x, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(eye2x, eyeY, eyeRx, eyeRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Pupils - follow aim direction
  const pShift = 1.8;
  const pDx = Math.cos(rad) * pShift;
  const pDy = -Math.sin(rad) * pShift;
  const pupilR = 2.2;
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(eye1x + pDx, eyeY + pDy, pupilR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2x + pDx, eyeY + pDy, pupilR, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine (bigger, more noticeable)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(eye1x - 1, eyeY - 1.8, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2x - 1, eyeY - 1.8, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // --- Eyebrows (expressive) ---
  ctx.strokeStyle = "#2c1810";
  ctx.lineCap = "round";
  if (isCurrent) {
    // Angry/determined eyebrows
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(eye1x - 4, eyeY - 6);
    ctx.lineTo(eye1x + 3, eyeY - 7.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eye2x - 3, eyeY - 7.5);
    ctx.lineTo(eye2x + 4, eyeY - 6);
    ctx.stroke();
  } else {
    // Neutral subtle eyebrows
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(eye1x - 3.5, eyeY - 6.5);
    ctx.lineTo(eye1x + 3, eyeY - 6.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eye2x - 3, eyeY - 6.5);
    ctx.lineTo(eye2x + 3.5, eyeY - 6.5);
    ctx.stroke();
  }

  // --- Mouth ---
  const mouthX = worm.x + fd * 3.5;
  const mouthY = worm.y + 7;
  if (isCurrent) {
    // Determined grin with teeth
    ctx.strokeStyle = "#3a1a0a";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(mouthX, mouthY, 4, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Teeth (2-3 small white rectangles)
    ctx.fillStyle = "#fff";
    for (let t = -1; t <= 1; t++) {
      ctx.fillRect(mouthX + t * 2.5 - 1, mouthY, 2, 2.2);
    }
    // Teeth outline
    ctx.strokeStyle = "#3a1a0a";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mouthX - 3.5, mouthY, 7, 2.2);
  } else {
    // Neutral line
    ctx.strokeStyle = "#3a1a0a";
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouthX - 3, mouthY);
    ctx.lineTo(mouthX + 3, mouthY);
    ctx.stroke();
  }

  // --- HP label (same logic) ---
  const hpText = `${worm.health}`;
  ctx.font = "bold 10px Trebuchet MS";
  ctx.textAlign = "center";
  const textWidth = ctx.measureText(hpText).width;
  const labelX = worm.x - textWidth / 2 - 5;
  const labelY = worm.y - bodyH - 22;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  const labelW = textWidth + 10;
  const labelH = 14;
  const labelR = 3;
  ctx.beginPath();
  ctx.moveTo(labelX + labelR, labelY);
  ctx.lineTo(labelX + labelW - labelR, labelY);
  ctx.quadraticCurveTo(labelX + labelW, labelY, labelX + labelW, labelY + labelR);
  ctx.lineTo(labelX + labelW, labelY + labelH - labelR);
  ctx.quadraticCurveTo(labelX + labelW, labelY + labelH, labelX + labelW - labelR, labelY + labelH);
  ctx.lineTo(labelX + labelR, labelY + labelH);
  ctx.quadraticCurveTo(labelX, labelY + labelH, labelX, labelY + labelH - labelR);
  ctx.lineTo(labelX, labelY + labelR);
  ctx.quadraticCurveTo(labelX, labelY, labelX + labelR, labelY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8f8fb";
  ctx.fillText(hpText, worm.x, labelY + 11);

  // Name tag
  ctx.font = "8px Trebuchet MS";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(worm.name, worm.x, labelY - 2);

  // Weapon + aim dot
  if (isCurrent && !state.gameOver) {
    const weaponId = getCurrentWeapon().id;
    drawWormWeapon(worm, rad, weaponId);
  }

  drawPowerBar(worm, isCurrent);
}

function drawPowerBar(worm, isCurrent) {
  const barWidth = 40;
  const barHeight = 6;
  const x = worm.x - barWidth / 2;
  const y = worm.y + config.wormRadius + 6;
  const power = isCurrent ? state.charge : 0;

  ctx.fillStyle = "rgba(15, 24, 40, 0.75)";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);

  if (power > 0) {
    const fillWidth = barWidth * clamp(power, 0, 1);
    const grad = ctx.createLinearGradient(x, y, x + barWidth, y);
    grad.addColorStop(0, "#06d6a0");
    grad.addColorStop(0.6, "#ffd166");
    grad.addColorStop(1, "#ef476f");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, fillWidth, barHeight);
  }
}
function drawProjectiles() {
  if (state.projectiles.length === 0) return;
  state.projectiles.forEach((p) => {
    const color = p.weaponId === "sniper" ? "#7fffd4" : "#ff4a6e";
    ctx.strokeStyle = "rgba(10, 12, 16, 0.7)";
    ctx.lineWidth = 1;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  });
}

function drawExplosions() {
  if (state.explosions.length === 0) return;
  state.explosions.forEach((boom) => {
    const t = clamp(boom.life / boom.duration, 0, 1);
    const ringRadius = boom.radius * (0.6 + t * 0.8);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 209, 102, ${0.45 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, boom.radius * (0.35 + t * 0.2), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(255, 90, 95, ${0.7 * (1 - t)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    boom.particles.forEach((p) => {
      const alpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.fillStyle = `rgba(255, 125, 70, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}
const hudWeaponSlots = [];

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTeamBanners() {
  const rojoAlive = state.worms.filter((w) => w.team === "Rojo" && w.alive).length;
  const azulAlive = state.worms.filter((w) => w.team === "Azul" && w.alive).length;
  const rojoTotal = state.worms.filter((w) => w.team === "Rojo").length;
  const azulTotal = state.worms.filter((w) => w.team === "Azul").length;
  const bw = 140;
  const bh = 32;
  const margin = 12;
  const r = 6;
  const activeTeam = getActiveTeam();

  // Rojo banner (left)
  const rx = margin;
  const ry = margin;
  ctx.save();
  const rojoActive = activeTeam === "Rojo";
  ctx.fillStyle = rojoActive ? "rgba(239, 71, 111, 0.85)" : "rgba(239, 71, 111, 0.5)";
  drawRoundedRect(rx, ry, bw, bh, r);
  ctx.fill();
  if (rojoActive) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = "bold 13px Trebuchet MS";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.fillText("ROJO", rx + 10, ry + 20);
  ctx.font = "12px Trebuchet MS";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${rojoAlive}/${rojoTotal}`, rx + bw - 10, ry + 20);
  ctx.restore();

  // Azul banner (right)
  const ax = state.width - margin - bw;
  const ay = margin;
  ctx.save();
  const azulActive = activeTeam === "Azul";
  ctx.fillStyle = azulActive ? "rgba(17, 138, 178, 0.85)" : "rgba(17, 138, 178, 0.5)";
  drawRoundedRect(ax, ay, bw, bh, r);
  ctx.fill();
  if (azulActive) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.font = "bold 13px Trebuchet MS";
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.fillText("AZUL", ax + 10, ay + 20);
  ctx.font = "12px Trebuchet MS";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${azulAlive}/${azulTotal}`, ax + bw - 10, ay + 20);
  ctx.restore();
}

function drawTurnTimer() {
  const timer = Math.max(0, Math.ceil(state.turnTimer));
  const cx = state.width / 2;
  const ty = 12;
  const tw = 60;
  const th = 30;
  const r = 8;
  const urgent = state.turnTimer < 5;

  ctx.save();
  ctx.fillStyle = urgent ? "rgba(200, 30, 30, 0.85)" : "rgba(15, 23, 42, 0.8)";
  drawRoundedRect(cx - tw / 2, ty, tw, th, r);
  ctx.fill();
  if (urgent) {
    ctx.strokeStyle = "#ef476f";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255, 209, 102, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = "bold 16px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillStyle = urgent ? "#ffd166" : "#f8f8fb";
  ctx.fillText(`${timer}`, cx, ty + 22);
  ctx.restore();
}

// ==================== Animated Clouds ====================

function initClouds() {
  state.clouds = [];
  state.windGusts = [];
  state.gustExtra = 0;
  state.gustTimer = 15 + Math.random() * 25;
  const count = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    state.clouds.push(createCloud(true));
  }
}

function createCloud(initial) {
  const w = state.width;
  const h = state.height;
  const cloudW = 60 + Math.random() * 100;
  const puffs = [];
  const puffCount = 3 + Math.floor(Math.random() * 3);
  for (let p = 0; p < puffCount; p++) {
    puffs.push({
      ox: (p - (puffCount - 1) / 2) * (cloudW / puffCount) * 0.7 + (Math.random() - 0.5) * 10,
      oy: (Math.random() - 0.5) * 12,
      rx: 18 + Math.random() * 22,
      ry: 12 + Math.random() * 10,
    });
  }
  return {
    x: initial ? Math.random() * w : (Math.random() > 0.5 ? -cloudW : w + cloudW),
    y: h * 0.06 + Math.random() * h * 0.28,
    speed: 8 + Math.random() * 15,
    alpha: 0.35 + Math.random() * 0.3,
    puffs: puffs,
    width: cloudW,
    depth: 0.5 + Math.random() * 0.5,
  };
}

function updateClouds(dt) {
  const windDrift = getEffectiveWind() * 3;
  for (let i = state.clouds.length - 1; i >= 0; i--) {
    const c = state.clouds[i];
    c.x += (c.speed + windDrift * c.depth) * dt;
    // Wrap around
    if (c.x - c.width > state.width + 50) {
      state.clouds[i] = createCloud(false);
      state.clouds[i].x = -state.clouds[i].width;
    } else if (c.x + c.width < -50) {
      state.clouds[i] = createCloud(false);
      state.clouds[i].x = state.width + state.clouds[i].width;
    }
  }
}

function drawClouds() {
  ctx.save();
  for (const c of state.clouds) {
    ctx.globalAlpha = c.alpha;
    for (const p of c.puffs) {
      const grad = ctx.createRadialGradient(
        c.x + p.ox, c.y + p.oy, 2,
        c.x + p.ox, c.y + p.oy, p.rx
      );
      grad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      grad.addColorStop(0.6, "rgba(255, 255, 255, 0.5)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(c.x + p.ox, c.y + p.oy, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ==================== Wind Gusts (comic style) ====================

function updateWindGusts(dt) {
  state.gustTimer -= dt;
  if (state.gustTimer <= 0) {
    state.gustTimer = 20 + Math.random() * 40;
    spawnWindGust();
  }
  // Compute gustExtra from active gusts
  let extra = 0;
  for (let i = state.windGusts.length - 1; i >= 0; i--) {
    const g = state.windGusts[i];
    g.life -= dt;
    if (g.life <= 0) {
      state.windGusts.splice(i, 1);
      continue;
    }
    g.progress = 1 - g.life / g.maxLife;
    // Ramp: ease-in 20%, full middle, ease-out 20%
    let intensity = 1;
    if (g.progress < 0.2) intensity = g.progress / 0.2;
    else if (g.progress > 0.8) intensity = (1 - g.progress) / 0.2;
    extra += g.extraWind * intensity;
    for (const line of g.lines) {
      line.x += g.dir * g.speed * dt;
    }
  }
  state.gustExtra = extra;
}

function getEffectiveWind() {
  return state.wind + state.gustExtra;
}

function spawnWindGust() {
  // Direction follows the current wind; if wind is 0 pick random
  const w = state.wind;
  const dir = w > 0 ? 1 : w < 0 ? -1 : (Math.random() > 0.5 ? 1 : -1);
  const gustStrength = 3 + Math.random() * 5;

  const lineCount = 8 + Math.floor(Math.random() * 8);
  const lines = [];
  const startX = dir > 0 ? -50 : state.width + 50;
  const bandY = state.height * 0.15 + Math.random() * state.height * 0.5;
  const bandH = 80 + Math.random() * 120;
  for (let i = 0; i < lineCount; i++) {
    lines.push({
      x: startX + (Math.random() - 0.5) * 60,
      y: bandY + Math.random() * bandH - bandH / 2,
      len: 30 + Math.random() * 60,
      thickness: 1 + Math.random() * 2,
      alpha: 0.3 + Math.random() * 0.4,
      waveSeed: Math.random() * Math.PI * 2,
    });
  }

  const duration = 1 + Math.random() * 3; // 1-4 seconds
  state.windGusts.push({
    dir: dir,
    speed: 250 + Math.random() * 200,
    lines: lines,
    life: duration,
    maxLife: duration,
    progress: 0,
    extraWind: dir * gustStrength,
  });
}

function drawWindGusts() {
  ctx.save();
  ctx.lineCap = "round";
  for (const g of state.windGusts) {
    const fadeIn = Math.min(1, g.progress * 4);
    const fadeOut = Math.min(1, g.life / 0.5);
    const opacity = fadeIn * fadeOut;
    for (const line of g.lines) {
      const wave = Math.sin(line.waveSeed + g.progress * 6) * 3;
      ctx.strokeStyle = `rgba(255, 255, 255, ${line.alpha * opacity})`;
      ctx.lineWidth = line.thickness;
      ctx.beginPath();
      ctx.moveTo(line.x, line.y + wave);
      ctx.quadraticCurveTo(
        line.x + g.dir * line.len * 0.5, line.y + wave - 2,
        line.x + g.dir * line.len, line.y + wave + 1
      );
      ctx.stroke();

      // Comic-style small swoosh marks
      if (line.thickness > 1.5) {
        ctx.strokeStyle = `rgba(220, 235, 255, ${line.alpha * opacity * 0.6})`;
        ctx.lineWidth = 0.8;
        const mx = line.x + g.dir * line.len * 0.3;
        const my = line.y + wave;
        ctx.beginPath();
        ctx.moveTo(mx, my - 4);
        ctx.lineTo(mx + g.dir * 8, my - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, my + 4);
        ctx.lineTo(mx + g.dir * 8, my + 3);
        ctx.stroke();
      }
    }

    // Comic "WHOOSH" text during peak
    if (g.progress > 0.2 && g.progress < 0.6) {
      const textOpacity = opacity * 0.5;
      const centerX = state.width / 2 + g.dir * 50;
      const centerY = g.lines[0] ? g.lines[0].y - 20 : state.height * 0.3;
      ctx.save();
      ctx.font = "bold italic 18px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 255, 255, ${textOpacity})`;
      ctx.strokeStyle = `rgba(0, 0, 0, ${textOpacity * 0.5})`;
      ctx.lineWidth = 2;
      const angle = g.dir * -0.08;
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);
      ctx.strokeText("WHOOSH!", 0, 0);
      ctx.fillText("WHOOSH!", 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawWindIndicator() {
  const cx = state.width / 2;
  const wy = 50;
  const wind = getEffectiveWind();
  const absWind = Math.abs(wind);
  const maxWind = 8;

  ctx.save();
  const bgW = 130;
  const bgH = 22;
  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  drawRoundedRect(cx - bgW / 2, wy, bgW, bgH, 5);
  ctx.fill();

  ctx.font = "10px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("VIENTO", cx, wy + 14);

  // Wind bar
  const barW = 40;
  const barH = 4;
  const barX = cx - barW / 2;
  const barY = wy + bgH - 6;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(barX, barY, barW, barH);

  if (wind !== 0) {
    const fillW = (absWind / maxWind) * (barW / 2);
    const color = wind > 0 ? "#06d6a0" : "#ef476f";
    ctx.fillStyle = color;
    if (wind > 0) {
      ctx.fillRect(cx, barY, fillW, barH);
    } else {
      ctx.fillRect(cx - fillW, barY, fillW, barH);
    }

    // Arrow
    const arrowX = wind > 0 ? cx + bgW / 2 - 18 : cx - bgW / 2 + 18;
    const dir = wind > 0 ? 1 : -1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(arrowX - dir * 6, wy + bgH / 2);
    ctx.lineTo(arrowX + dir * 6, wy + bgH / 2);
    ctx.lineTo(arrowX + dir * 2, wy + bgH / 2 - 4);
    ctx.moveTo(arrowX + dir * 6, wy + bgH / 2);
    ctx.lineTo(arrowX + dir * 2, wy + bgH / 2 + 4);
    ctx.stroke();
  }

  // Wind speed text
  ctx.font = "bold 10px Trebuchet MS";
  ctx.fillStyle = "#ffd166";
  ctx.textAlign = "left";
  ctx.fillText(`${absWind}`, cx + bgW / 2 - 12, wy + 14);
  ctx.textAlign = "right";
  ctx.fillText(`${absWind}`, cx - bgW / 2 + 12, wy + 14);

  ctx.restore();
}

function drawWeaponBar() {
  const locked = state.projectiles.length > 0 || state.charging || state.gameOver;
  const slotW = 70;
  const slotH = 44;
  const gap = 6;
  const totalW = weapons.length * slotW + (weapons.length - 1) * gap;
  const startX = (state.width - totalW) / 2;
  const startY = state.height - slotH - 50;
  const r = 6;

  hudWeaponSlots.length = 0;

  ctx.save();
  // Background strip
  ctx.fillStyle = "rgba(10, 14, 24, 0.6)";
  drawRoundedRect(startX - 8, startY - 4, totalW + 16, slotH + 8, 8);
  ctx.fill();

  for (let i = 0; i < weapons.length; i++) {
    const x = startX + i * (slotW + gap);
    const y = startY;
    const isActive = i === state.weaponIndex;

    hudWeaponSlots.push({ x, y, w: slotW, h: slotH, index: i });

    if (isActive) {
      ctx.fillStyle = "rgba(255, 209, 102, 0.25)";
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = locked ? "rgba(15, 24, 40, 0.4)" : "rgba(15, 24, 40, 0.65)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
    }

    drawRoundedRect(x, y, slotW, slotH, r);
    ctx.fill();
    ctx.stroke();

    // Key number (top-left corner)
    ctx.font = "bold 9px Trebuchet MS";
    ctx.textAlign = "left";
    ctx.fillStyle = isActive ? "#ffd166" : "rgba(255,255,255,0.5)";
    ctx.fillText(`${i + 1}`, x + 4, y + 10);

    // Weapon icon (centered in upper area)
    const iconAlpha = locked && !isActive ? 0.4 : 1;
    ctx.globalAlpha = iconAlpha;
    drawWeaponIcon(weapons[i].id, x + slotW / 2, y + 20, 0.85);
    ctx.globalAlpha = 1;

    // Weapon name (below icon)
    ctx.font = "9px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillStyle = isActive ? "#fff" : (locked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.75)");
    ctx.fillText(weapons[i].name, x + slotW / 2, y + 39);
  }
  ctx.restore();
}

function drawStatusBar() {
  const worm = state.worms[state.currentIndex];
  if (!worm) return;

  const barY = state.height - 38;
  const margin = 12;

  ctx.save();
  // Background
  ctx.fillStyle = "rgba(10, 14, 24, 0.6)";
  drawRoundedRect(margin, barY - 4, state.width - margin * 2, 30, 6);
  ctx.fill();

  // Worm name + HP (left)
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "left";
  const teamColor = worm.team === "Rojo" ? "#ef476f" : "#118ab2";
  ctx.fillStyle = teamColor;
  ctx.fillText(`${worm.name}`, margin + 10, barY + 16);

  ctx.font = "12px Trebuchet MS";
  ctx.fillStyle = "#f8f8fb";
  ctx.fillText(`HP ${worm.health}`, margin + 90, barY + 16);

  // Power bar (center)
  const pbX = state.width / 2 - 100;
  const pbW = 200;
  const pbH = 10;
  const pbY = barY + 7;

  ctx.fillStyle = "rgba(15, 24, 40, 0.8)";
  ctx.fillRect(pbX, pbY, pbW, pbH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pbX, pbY, pbW, pbH);

  if (state.charge > 0) {
    const fillW = pbW * clamp(state.charge, 0, 1);
    const grad = ctx.createLinearGradient(pbX, pbY, pbX + pbW, pbY);
    grad.addColorStop(0, "#06d6a0");
    grad.addColorStop(0.6, "#ffd166");
    grad.addColorStop(1, "#ef476f");
    ctx.fillStyle = grad;
    ctx.fillRect(pbX, pbY, fillW, pbH);
  }

  // Segments
  for (let i = 1; i < 10; i++) {
    const sx = pbX + (pbW / 10) * i;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(sx, pbY);
    ctx.lineTo(sx, pbY + pbH);
    ctx.stroke();
  }

  // Power % (right)
  ctx.font = "bold 12px Trebuchet MS";
  ctx.textAlign = "right";
  ctx.fillStyle = state.charging ? "#ffd166" : "#f8f8fb";
  ctx.fillText(`${Math.round(state.charge * 100)}%`, state.width - margin - 10, barY + 16);

  // Weapon name (right of power)
  ctx.font = "11px Trebuchet MS";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  const weapon = getCurrentWeapon();
  ctx.fillText(weapon.name, state.width - margin - 55, barY + 16);

  ctx.restore();
}

function drawCommentatorAvatar(cx, cy, scale) {
  const s = scale;
  ctx.save();
  ctx.translate(cx, cy);

  // Body/shirt
  ctx.fillStyle = "#2c3e50";
  ctx.beginPath();
  ctx.ellipse(0, s * 18, s * 14, s * 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Shirt collar accent
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.moveTo(-s * 5, s * 8);
  ctx.lineTo(0, s * 14);
  ctx.lineTo(s * 5, s * 8);
  ctx.closePath();
  ctx.fill();

  // Head
  const headGrad = ctx.createRadialGradient(-s * 2, -s * 6, s * 2, 0, -s * 2, s * 14);
  headGrad.addColorStop(0, "#f5cba7");
  headGrad.addColorStop(1, "#d4a574");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, -s * 2, s * 11, s * 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.ellipse(0, -s * 12, s * 12, s * 6, 0, Math.PI, 0);
  ctx.fill();
  // Side hair
  ctx.beginPath();
  ctx.ellipse(-s * 11, -s * 4, s * 3, s * 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 11, -s * 4, s * 3, s * 7, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Headphones band
  ctx.strokeStyle = "#333";
  ctx.lineWidth = s * 2.5;
  ctx.beginPath();
  ctx.arc(0, -s * 8, s * 14, Math.PI + 0.3, -0.3);
  ctx.stroke();

  // Headphone ear pads
  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.ellipse(-s * 13, -s * 2, s * 4, s * 6, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.ellipse(-s * 13, -s * 2, s * 2.5, s * 4, 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#444";
  ctx.beginPath();
  ctx.ellipse(s * 13, -s * 2, s * 4, s * 6, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.ellipse(s * 13, -s * 2, s * 2.5, s * 4, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-s * 4, -s * 3, s * 3, s * 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(s * 4, -s * 3, s * 3, s * 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(-s * 3.5, -s * 2.5, s * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 4.5, -s * 2.5, s * 1.6, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(-s * 4.2, -s * 3.5, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 3.8, -s * 3.5, s * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Mouth - excited open smile
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.arc(0, s * 5, s * 4, 0.1, Math.PI - 0.1);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.rect(-s * 2.5, s * 4.5, s * 5, s * 1.5);
  ctx.fill();

  // Microphone boom
  ctx.strokeStyle = "#666";
  ctx.lineWidth = s * 1.5;
  ctx.beginPath();
  ctx.moveTo(-s * 12, s * 2);
  ctx.quadraticCurveTo(-s * 10, s * 10, -s * 2, s * 8);
  ctx.stroke();

  // Mic head
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.ellipse(-s * 2, s * 8, s * 2.5, s * 2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#888";
  ctx.beginPath();
  ctx.arc(-s * 2, s * 8, s * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSpeechBubble(bx, by, bw, bh, tailX, tailY) {
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);

  // Tail from bottom-left area
  ctx.lineTo(bx + 40, by + bh);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(bx + 20, by + bh);

  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
}

function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCommentary() {
  if (commentaryState.timer <= 0 || !commentaryState.text) return;

  const alpha = commentaryState.timer < 0.8
    ? commentaryState.timer / 0.8
    : 1;

  const popScale = commentaryState.popTimer > 0
    ? 1 + commentaryState.popTimer * 0.15
    : 1;

  const avatarX = 38;
  const avatarY = isMobile ? state.height - 180 : state.height - 110;
  const avatarScale = 1.6;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Avatar circle background
  ctx.fillStyle = "rgba(10, 14, 24, 0.75)";
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawCommentatorAvatar(avatarX, avatarY, avatarScale);

  // Speech bubble
  ctx.font = "bold 12px Trebuchet MS";
  const maxTextW = 200;
  const lines = wrapText(commentaryState.text, maxTextW);
  const lineH = 16;
  const padding = 10;
  const bubbleW = maxTextW + padding * 2;
  const bubbleH = lines.length * lineH + padding * 2;
  const bubbleX = avatarX + 38;
  const bubbleY = avatarY - bubbleH - 20;
  const tailX = avatarX + 20;
  const tailY = avatarY - 18;

  ctx.save();
  if (popScale !== 1) {
    const pivotX = bubbleX + bubbleW * 0.2;
    const pivotY = bubbleY + bubbleH;
    ctx.translate(pivotX, pivotY);
    ctx.scale(popScale, popScale);
    ctx.translate(-pivotX, -pivotY);
  }

  // Bubble shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  drawSpeechBubble(bubbleX + 3, bubbleY + 3, bubbleW, bubbleH, tailX + 3, tailY + 3);
  ctx.fill();

  // Bubble fill
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  drawSpeechBubble(bubbleX, bubbleY, bubbleW, bubbleH, tailX, tailY);
  ctx.fill();

  // Bubble border
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Text
  ctx.font = "bold 12px Trebuchet MS";
  ctx.fillStyle = "#1a1a2e";
  ctx.textAlign = "left";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bubbleX + padding, bubbleY + padding + 12 + i * lineH);
  }

  ctx.restore();
  ctx.restore();
}

function updateTouchLayout() {
  touchButtons.length = 0;
  const w = state.width;
  const h = state.height;

  // Weapon bar occupies: y = h-94 to h-46, status bar: h-42 to h-8
  // Commentator avatar at (38, h-110) r=32 → left x 6..70, y h-142..h-78
  // Place controls ABOVE weapon bar zone (h - 100) and away from commentator

  const btnSize = 52;
  const gap = 8;
  const margin = 14;
  const fireR = 36;
  const wpnW = 38;
  const wpnH = 34;

  // Bottom edge for controls = above weapon bar background (h - 100)
  const controlsBottom = h - 104;

  // Move buttons (left side, vertically centered, shifted right to avoid commentator)
  // Commentator occupies x 0..76 roughly, so start at x=80
  const moveBaseX = 80;
  const moveY = controlsBottom - btnSize;
  touchButtons.push({
    id: "left", x: moveBaseX, y: moveY, w: btnSize, h: btnSize,
    shape: "rect", label: "\u25C4", key: "ArrowLeft",
  });
  touchButtons.push({
    id: "right", x: moveBaseX + btnSize + gap, y: moveY, w: btnSize, h: btnSize,
    shape: "rect", label: "\u25BA", key: "ArrowRight",
  });

  // Fire + Aim (right side, above weapon bar)
  // Fire circle sits just above controlsBottom
  const fireCx = w - margin - fireR;
  const fireCy = controlsBottom - fireR;
  touchButtons.push({
    id: "fire", x: fireCx - fireR, y: fireCy - fireR, w: fireR * 2, h: fireR * 2,
    shape: "circle", label: "\uD83D\uDD25", key: "Space", r: fireR,
    cx: fireCx, cy: fireCy,
  });
  // Aim buttons stacked to the LEFT of fire
  const aimX = fireCx - fireR - gap - btnSize;
  touchButtons.push({
    id: "aimup", x: aimX, y: fireCy - btnSize - gap / 2,
    w: btnSize, h: btnSize, shape: "rect", label: "\u25B2", key: "ArrowUp",
  });
  touchButtons.push({
    id: "aimdown", x: aimX, y: fireCy + gap / 2,
    w: btnSize, h: btnSize, shape: "rect", label: "\u25BC", key: "ArrowDown",
  });

  // Weapon prev/next (flanking the weapon bar)
  const slotW = 70;
  const slotGap = 6;
  const totalW = weapons.length * slotW + (weapons.length - 1) * slotGap;
  const barStartX = (w - totalW) / 2;
  const barY = h - 44 - 50;
  touchButtons.push({
    id: "wpnprev", x: barStartX - wpnW - gap, y: barY + (44 - wpnH) / 2,
    w: wpnW, h: wpnH, shape: "rect", label: "\u25C0", key: "wpnprev",
  });
  touchButtons.push({
    id: "wpnnext", x: barStartX + totalW + gap, y: barY + (44 - wpnH) / 2,
    w: wpnW, h: wpnH, shape: "rect", label: "\u25B6", key: "wpnnext",
  });
}

function getTouchedButton(tx, ty) {
  for (const btn of touchButtons) {
    if (btn.shape === "circle") {
      const dx = tx - btn.cx;
      const dy = ty - btn.cy;
      if (dx * dx + dy * dy <= btn.r * btn.r) return btn;
    } else {
      if (tx >= btn.x && tx <= btn.x + btn.w && ty >= btn.y && ty <= btn.y + btn.h) return btn;
    }
  }
  return null;
}

function touchActionDown(btn) {
  if (!btn) return;
  if (btn.key === "wpnprev") {
    setWeapon(state.weaponIndex - 1);
    return;
  }
  if (btn.key === "wpnnext") {
    setWeapon(state.weaponIndex + 1);
    return;
  }
  if (btn.key === "Space") {
    if (!state.charging && state.projectiles.length === 0 && !state.gameOver) {
      state.charging = true;
      state.charge = 0;
      state.chargeDir = 1;
      updateHud();
    }
    return;
  }
  const keyMap = { ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown" };
  if (keyMap[btn.key]) keys.add(btn.key);
}

function touchActionUp(btn) {
  if (!btn) return;
  if (btn.key === "wpnprev" || btn.key === "wpnnext") return;
  if (btn.key === "Space") {
    if (state.charging && state.projectiles.length === 0 && !state.gameOver) {
      const worm = state.worms[state.currentIndex];
      const weapon = getCurrentWeapon();
      fireProjectile(worm, state.charge, weapon);
    }
    state.charging = false;
    state.chargeDir = 1;
    state.charge = 0;
    updateHud();
    return;
  }
  keys.delete(btn.key);
}

function initTouchControls() {
  updateTouchLayout();

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.width / rect.width;
    const scaleY = state.height / rect.height;
    for (const touch of e.changedTouches) {
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;
      const btn = getTouchedButton(tx, ty);
      if (btn) {
        activeTouches.set(touch.identifier, btn.id);
        touchActionDown(btn);
      } else {
        // Check weapon bar slots
        for (const slot of hudWeaponSlots) {
          if (tx >= slot.x && tx <= slot.x + slot.w && ty >= slot.y && ty <= slot.y + slot.h) {
            setWeapon(slot.index);
            break;
          }
        }
      }
      // Handle game over restart tap
      if (state.gameOver) {
        if (!net.enabled) resetGame();
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.width / rect.width;
    const scaleY = state.height / rect.height;
    for (const touch of e.changedTouches) {
      const tx = (touch.clientX - rect.left) * scaleX;
      const ty = (touch.clientY - rect.top) * scaleY;
      const prevId = activeTouches.get(touch.identifier);
      const btn = getTouchedButton(tx, ty);
      const newId = btn ? btn.id : null;
      if (prevId !== newId) {
        // Finger moved off previous button
        if (prevId) {
          const prevBtn = touchButtons.find((b) => b.id === prevId);
          touchActionUp(prevBtn);
        }
        // Finger moved onto new button
        if (btn) {
          activeTouches.set(touch.identifier, btn.id);
          touchActionDown(btn);
        } else {
          activeTouches.delete(touch.identifier);
        }
      }
    }
  }, { passive: false });

  const handleTouchEnd = (e) => {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      const btnId = activeTouches.get(touch.identifier);
      if (btnId) {
        const btn = touchButtons.find((b) => b.id === btnId);
        touchActionUp(btn);
        activeTouches.delete(touch.identifier);
      }
    }
  };

  canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
}

function drawTouchControls() {
  ctx.save();
  for (const btn of touchButtons) {
    const isPressed = [...activeTouches.values()].includes(btn.id);

    if (btn.shape === "circle") {
      ctx.beginPath();
      ctx.arc(btn.cx, btn.cy, btn.r, 0, Math.PI * 2);
      ctx.fillStyle = isPressed ? "rgba(255,100,50,0.45)" : "rgba(0,0,0,0.35)";
      ctx.fill();
      ctx.strokeStyle = isPressed ? "rgba(255,180,100,0.7)" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.round(btn.r * 0.8)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(btn.label, btn.cx, btn.cy);
    } else {
      const r = 8;
      ctx.fillStyle = isPressed ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)";
      drawRoundedRect(btn.x, btn.y, btn.w, btn.h, r);
      ctx.fill();
      ctx.strokeStyle = isPressed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const fontSize = btn.id.startsWith("wpn") ? Math.round(btn.h * 0.45) : Math.round(btn.h * 0.5);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isPressed ? "#fff" : "rgba(255,255,255,0.85)";
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
  }
  ctx.restore();
}

function drawHud() {
  drawTeamBanners();
  drawTurnTimer();
  drawWindIndicator();
  drawWeaponBar();
  drawStatusBar();
  drawCommentary();
  if (isMobile) drawTouchControls();
}

function render() {
  if (!ctx) return;
  if (!state.width || !state.height) return;
  if (net.enabled) {
    applyInterpolatedState();
  }
  const scaleX = canvas.width / state.width;
  const scaleY = canvas.height / state.height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  drawBackground();
  drawClouds();
  drawWindGusts();
  drawTerrain();
  drawTrajectory();
  state.worms.forEach((worm, index) => drawWorm(worm, index === state.currentIndex));
  drawProjectiles();
  drawExplosions();
  drawHealthPacks();
  drawHud();

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`Ganador: ${state.winner}`, state.width / 2, state.height / 2);
    ctx.font = "16px Trebuchet MS";
    ctx.fillText(isMobile ? "Toca para reiniciar" : "Pulsa R para reiniciar", state.width / 2, state.height / 2 + 30);
  }
}

function updateCharge(dt) {
  if (!state.charging) return;
  state.charge += config.chargeRate * dt * state.chargeDir;
  if (state.charge >= 1) {
    state.charge = 1;
    state.chargeDir = -1;
  }
  if (state.charge <= 0) {
    state.charge = 0;
    state.chargeDir = 1;
  }
  updateHud();
}

function step(dt) {
  const cdt = Math.min(0.033, dt);
  if (commentaryState.timer > 0) commentaryState.timer -= cdt;
  if (commentaryState.popTimer > 0) commentaryState.popTimer -= cdt;
  updateClouds(cdt);
  updateWindGusts(cdt);
  if (net.enabled) {
    updateExplosions(cdt);
    return;
  }
  const safeDt = Math.min(0.033, dt);
  if (!state.gameOver) {
    updateAI(safeDt);
    state.worms.forEach((worm, index) => {
      const isActive = index === state.currentIndex && worm.alive;
      updateWorm(worm, safeDt, isActive);
    });
    updateProjectiles(safeDt);
    updateExplosions(safeDt);
    updateCharge(safeDt);
    updateHealthPacks(safeDt);
    state.packSpawnTimer -= safeDt;
    if (state.packSpawnTimer <= 0) {
      state.packSpawnTimer = 25 + Math.random() * 15;
      if (state.healthPacks.length < 3) {
        spawnHealthPack();
      }
    }
    if (state.projectiles.length === 0 && !state.gameOver) {
      state.turnTimer -= safeDt;
      if (state.turnTimer <= 0) {
        state.turnTimer = 0;
        const worm = state.worms[state.currentIndex];
        if (worm && worm.alive) {
          const weapon = getCurrentWeapon();
          const power = state.charging ? state.charge : 0.5;
          state.charging = false;
          state.charge = 0;
          state.chargeDir = 1;
          fireProjectile(worm, power, weapon);
        }
      }
    }
  }
}

function handleKeyDown(event, sourceTeam = null) {
  if (!canApplyInput(sourceTeam)) return false;
  if (event.code === "Space") {
    if (!state.charging && state.projectiles.length === 0 && !state.gameOver) {
      state.charging = true;
      state.charge = 0;
      state.chargeDir = 1;
      updateHud();
    }
    event.preventDefault();
  }

  if (event.code === "Digit1") {
    setWeapon(0);
  }
  if (event.code === "Digit2") {
    setWeapon(1);
  }
  if (event.code === "Digit3") {
    setWeapon(2);
  }
  if (event.code === "Digit4") {
    setWeapon(3);
  }
  if (event.code === "Digit5") {
    setWeapon(4);
  }
  if (event.code === "KeyQ") {
    setWeapon(state.weaponIndex - 1);
  }
  if (event.code === "KeyE") {
    setWeapon(state.weaponIndex + 1);
  }

  keys.add(event.key);
  return true;
}

function handleKeyUp(event, sourceTeam = null) {
  if (!canApplyInput(sourceTeam)) return false;
  if (event.code === "Space") {
    if (state.charging && state.projectiles.length === 0 && !state.gameOver) {
      const worm = state.worms[state.currentIndex];
      const weapon = getCurrentWeapon();
      fireProjectile(worm, state.charge, weapon);
    }
    state.charging = false;
    state.chargeDir = 1;
    state.charge = 0;
    updateHud();
    event.preventDefault();
  }

  keys.delete(event.key);
  return true;
}

function handleCanvasClick(event) {
  if (!canvas || !state.width || !state.height) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = state.width / rect.width;
  const scaleY = state.height / rect.height;
  const mx = (event.clientX - rect.left) * scaleX;
  const my = (event.clientY - rect.top) * scaleY;

  for (const slot of hudWeaponSlots) {
    if (mx >= slot.x && mx <= slot.x + slot.w && my >= slot.y && my <= slot.y + slot.h) {
      if (net.enabled) {
        if (!canApplyInput()) return;
        const code = `Digit${slot.index + 1}`;
        sendNet({ type: "input", action: "keydown", code, key: code });
        return;
      }
      setWeapon(slot.index);
      return;
    }
  }
}

function bindInput(phaserScene) {
  canvas.addEventListener("click", handleCanvasClick);

  phaserScene.input.keyboard.on("keydown", (event) => {
    if (event.code === "KeyR") {
      if (net.enabled) {
        if (net.connected) {
          sendNet({ type: "reset", seed: Math.floor(Math.random() * 1e9) });
        } else {
          resetGame();
        }
      } else {
        resetGame();
      }
      return;
    }

    if (net.enabled) {
      if (canApplyInput()) {
        sendNet({ type: "input", action: "keydown", code: event.code, key: event.key });
      }
      return;
    }

    handleKeyDown(event);
  });

  phaserScene.input.keyboard.on("keyup", (event) => {
    if (net.enabled) {
      if (canApplyInput()) {
        sendNet({ type: "input", action: "keyup", code: event.code, key: event.key });
      }
      return;
    }

    handleKeyUp(event);
  });

  if (isMobile) initTouchControls();
}

// UI Logic
document.getElementById("btn-singleplayer").addEventListener("click", () => {
  document.getElementById("menu-overlay").classList.add("hidden");
  net.enabled = false;
  resetGame();
});

document.getElementById("btn-multiplayer").addEventListener("click", () => {
  document.getElementById("mode-selection").classList.add("hidden");
  document.getElementById("waiting-screen").classList.remove("hidden");
  net.enabled = true;
  connectNet();
});

document.getElementById("btn-cancel").addEventListener("click", () => {
  if (net.ws) {
    net.ws.close();
    net.ws = null;
  }
  net.connected = false;
  net.enabled = false;
  document.getElementById("waiting-screen").classList.add("hidden");
  document.getElementById("mode-selection").classList.remove("hidden");
});
