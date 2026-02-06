const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8080);
const wss = new WebSocketServer({ port: PORT });

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const TICK_RATE = 30;

const WIND_SCALE = 20;

const config = {
  gravity: 900,
  moveSpeed: 90,
  angleSpeed: 90,
  wormRadius: 12,
  chargeRate: 0.9,
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

let seed = Math.floor(Math.random() * 1e9);
let nextId = 1;

const clients = new Map();
const pressed = new Set();

const state = {
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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
  wind: 0,
  seed,
  turnTimer: 30,
  turnTimerMax: 30,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function createRng(seedValue) {
  let t = seedValue >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRand(rng, min, max) {
  return rng() * (max - min) + min;
}

function terrainHeightAt(x) {
  const xi = Math.floor(clamp(x, 0, state.width - 1));
  return state.terrain[xi] ?? state.height;
}

function flattenRange(x0, x1, y) {
  const start = Math.floor(clamp(x0, 0, state.width));
  const end = Math.floor(clamp(x1, 0, state.width));
  for (let x = start; x <= end; x += 1) {
    state.terrain[x] = y;
  }
}

function smoothTerrain(passes) {
  for (let p = 0; p < passes; p++) {
    const copy = [...state.terrain];
    for (let x = 1; x < state.terrain.length - 1; x++) {
      state.terrain[x] = (copy[x - 1] + copy[x] + copy[x + 1]) / 3;
    }
  }
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

function buildTerrain() {
  const w = state.width;
  const h = state.height;
  const rng = createRng(state.seed || 1);
  state.terrain = new Array(Math.floor(w) + 1);

  const base = seededRand(rng, h * 0.58, h * 0.75);

  const numWaves = Math.floor(seededRand(rng, 2, 6));
  const waves = [];
  for (let i = 0; i < numWaves; i++) {
    waves.push({
      freq: seededRand(rng, 0.004, 0.045),
      amp: seededRand(rng, h * 0.015, h * 0.12),
      phase: seededRand(rng, 0, Math.PI * 2),
    });
  }

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

  for (let x = 0; x <= w; x++) {
    state.terrain[x] = clamp(state.terrain[x], h * 0.4, h * 0.92);
  }

  smoothTerrain(3);

  const numPlatforms = Math.floor(seededRand(rng, 0, 3));
  for (let i = 0; i < numPlatforms; i++) {
    const px = seededRand(rng, w * 0.35, w * 0.65);
    const pw = seededRand(rng, w * 0.04, w * 0.1);
    const ph = seededRand(rng, h * 0.45, h * 0.72);
    flattenRange(px - pw / 2, px + pw / 2, ph);
  }

  const leftAvg = avgTerrainHeight(Math.floor(w * 0.18), Math.floor(w * 0.32));
  const rightAvg = avgTerrainHeight(Math.floor(w * 0.68), Math.floor(w * 0.84));
  flattenRange(w * 0.18, w * 0.32, clamp(leftAvg, h * 0.43, h * 0.78));
  flattenRange(w * 0.68, w * 0.84, clamp(rightAvg, h * 0.43, h * 0.78));

  state.mapName = generateMapName(rng);
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

function resetGame(seedOverride) {
  if (Number.isFinite(seedOverride)) {
    state.seed = Math.floor(seedOverride);
  }
  state.gameOver = false;
  state.winner = null;
  state.projectiles = [];
  state.charge = 0;
  state.charging = false;
  state.weaponIndex = 0;
  state.turnTimer = state.turnTimerMax;
  state.wind = Math.floor(Math.random() * 11) - 5;
  buildTerrain();
  createWorms();
}

function getActiveTeam() {
  const worm = state.worms[state.currentIndex];
  return worm?.team ?? null;
}

function nextTurn() {
  const alive = state.worms.filter((worm) => worm.alive);
  const teams = new Set(alive.map((worm) => worm.team));
  if (teams.size <= 1) {
    state.gameOver = true;
    state.winner = alive[0]?.team ?? "Nadie";
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
  state.charging = false;
  state.turnTimer = state.turnTimerMax;
  pressed.clear();
}

function updateWorm(worm, dt, isActive) {
  if (!worm.alive) return;

  if (isActive && state.projectiles.length === 0) {
    const left = pressed.has("ArrowLeft");
    const right = pressed.has("ArrowRight");
    const up = pressed.has("ArrowUp");
    const down = pressed.has("ArrowDown");

    if (left !== right) {
      const dir = left ? -1 : 1;
      worm.x += dir * config.moveSpeed * dt;
      worm.x = clamp(worm.x, config.wormRadius, state.width - config.wormRadius);
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

  for (let i = 0; i < burst; i += 1) {
    const offset = burst === 1 ? 0 : (i - (burst - 1) / 2) * spread;
    const rad = ((centerAngle + offset) * Math.PI) / 180;
    const speed = baseSpeed * (1 + (Math.random() * 2 - 1) * jitter);
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
    p.vx += state.wind * WIND_SCALE * dt;
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
  broadcast({ type: "crater", x, y, radius });

  state.worms.forEach((worm) => {
    if (!worm.alive) return;
    const dx = worm.x - x;
    const dy = worm.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) return;

    const falloff = 1 - dist / radius;
    const damage = Math.round(falloff * maxDamage);
    worm.health -= damage;
    if (worm.health <= 0) {
      worm.alive = false;
      return;
    }

    const knock = 260 * falloff;
    const angle = Math.atan2(dy, dx);
    worm.vx += Math.cos(angle) * knock;
    worm.vy += Math.sin(angle) * knock - 200 * falloff;
    worm.onGround = false;
  });
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
}

function handleKeyDown(code) {
  if (code === "Space") {
    if (!state.charging && state.projectiles.length === 0 && !state.gameOver) {
      state.charging = true;
      state.charge = 0;
      state.chargeDir = 1;
    }
  }
  if (code === "Digit1") state.weaponIndex = 0;
  if (code === "Digit2") state.weaponIndex = 1;
  if (code === "Digit3") state.weaponIndex = 2;
  if (code === "Digit4") state.weaponIndex = 3;
  if (code === "Digit5") state.weaponIndex = 4;
  if (code === "KeyQ") state.weaponIndex = (state.weaponIndex - 1 + weapons.length) % weapons.length;
  if (code === "KeyE") state.weaponIndex = (state.weaponIndex + 1) % weapons.length;
}

function handleKeyUp(code) {
  if (code === "Space") {
    if (state.charging && state.projectiles.length === 0 && !state.gameOver) {
      const worm = state.worms[state.currentIndex];
      const weapon = weapons[state.weaponIndex] ?? weapons[0];
      fireProjectile(worm, state.charge, weapon);
    }
    state.charging = false;
    state.chargeDir = 1;
    state.charge = 0;
  }
}

function step(dt) {
  if (state.gameOver) return;
  state.worms.forEach((worm, index) => {
    const isActive = index === state.currentIndex && worm.alive;
    updateWorm(worm, dt, isActive);
  });
  updateProjectiles(dt);
  updateCharge(dt);
  if (state.projectiles.length === 0 && !state.gameOver) {
    state.turnTimer -= dt;
    if (state.turnTimer <= 0) {
      state.turnTimer = 0;
      const worm = state.worms[state.currentIndex];
      if (worm && worm.alive) {
        const weapon = weapons[state.weaponIndex] ?? weapons[0];
        const power = state.charging ? state.charge : 0.5;
        state.charging = false;
        state.charge = 0;
        state.chargeDir = 1;
        fireProjectile(worm, power, weapon);
      }
    }
  }
}

function snapshot(full = false) {
  const snap = {
    width: state.width,
    height: state.height,
    seed: state.seed,
    worms: state.worms,
    currentIndex: state.currentIndex,
    weaponIndex: state.weaponIndex,
    projectiles: state.projectiles,
    charging: state.charging,
    charge: state.charge,
    gameOver: state.gameOver,
    winner: state.winner,
    wind: state.wind,
    turnTimer: state.turnTimer,
    turnTimerMax: state.turnTimerMax,
  };
  if (full) {
    snap.terrain = state.terrain;
  }
  return snap;
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function broadcastState(full = false) {
  broadcast({ type: "state", state: snapshot(full) });
}

function teamCounts() {
  const counts = { Rojo: 0, Azul: 0 };
  for (const info of clients.values()) {
    if (info.team === "Rojo") counts.Rojo += 1;
    if (info.team === "Azul") counts.Azul += 1;
  }
  return counts;
}

function assignTeam() {
  const counts = teamCounts();
  if (counts.Rojo === 0) return "Rojo";
  if (counts.Azul === 0) return "Azul";
  return "Spectator";
}

function broadcastPlayers() {
  const players = Array.from(clients.values()).map(({ id, team }) => ({ id, team }));
  broadcast({ type: "players", players });
}

wss.on("connection", (ws) => {
  const id = `p${nextId++}`;
  const team = assignTeam();
  clients.set(ws, { id, team });

  ws.on("message", (data) => {
    let msg = null;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      ws.send(JSON.stringify({ type: "welcome", id, team, seed: state.seed, state: snapshot(true) }));
      broadcastPlayers();
      return;
    }

    if (msg.type === "input") {
      if (team === "Spectator") return;
      if (team !== getActiveTeam()) return;
      if (msg.action === "keydown") {
        pressed.add(msg.code);
        handleKeyDown(msg.code);
      } else if (msg.action === "keyup") {
        pressed.delete(msg.code);
        handleKeyUp(msg.code);
      }
      return;
    }

    if (msg.type === "reset") {
      const incomingSeed = Number(msg.seed);
      seed = Number.isFinite(incomingSeed) ? Math.floor(incomingSeed) : Math.floor(Math.random() * 1e9);
      state.seed = seed;
      resetGame(seed);
      broadcast({ type: "reset", state: snapshot(true) });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcastPlayers();
  });
});

resetGame(seed);
setInterval(() => {
  step(1 / TICK_RATE);
  broadcastState(false);
}, 1000 / TICK_RATE);

console.log(`WS server listo en ws://localhost:${PORT}`);
