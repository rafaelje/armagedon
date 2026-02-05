let canvas = null;
let ctx = null;

const hudTurn = document.getElementById("turn");
const hudPower = document.getElementById("power");
const hudWeapon = document.getElementById("weapon");
const hudWind = document.getElementById("wind");
const hudBadge = document.getElementById("turnbadge");
const powerBar = document.getElementById("powerbar");
const powerFill = document.getElementById("powerfill");
const weaponList = document.getElementById("weaponlist");
const commentaryEl = document.getElementById("commentary");
const commentaryText = document.getElementById("commentary-text");
const turnBanner = document.getElementById("turnbanner");
const turnTeamLabel = document.getElementById("turnteam");

const keys = new Set();

const net = {
  enabled: new URLSearchParams(window.location.search).has("mp"),
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
  seed: 0,
};

const visuals = {
  width: 0,
  height: 0,
  seed: 0,
  bgCanvas: null,
  soilPattern: null,
};

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
connectNet();

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

  gctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  for (let i = 0; i < 4; i += 1) {
    const x = seededRand(rng, state.width * 0.1, state.width * 0.9);
    const y = seededRand(rng, state.height * 0.08, state.height * 0.38);
    const w = seededRand(rng, 80, 140);
    const h = seededRand(rng, 24, 40);
    gctx.beginPath();
    gctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    gctx.fill();
  }

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
  const width = state.width;
  const height = state.height;
  const base = height * 0.68;
  const amp1 = height * 0.12;
  const amp2 = height * 0.06;
  const rng = createRng(state.seed || 1);
  const phase1 = seededRand(rng, 0, Math.PI * 2);
  const phase2 = seededRand(rng, 0, Math.PI * 2);

  state.terrain = new Array(Math.floor(width) + 1);
  for (let x = 0; x <= width; x += 1) {
    const y = base + Math.sin(x * 0.01 + phase1) * amp1 + Math.sin(x * 0.004 + phase2) * amp2;
    state.terrain[x] = clamp(y, height * 0.45, height * 0.92);
  }

  const platformY = height * 0.55;
  flattenRange(width * 0.18, width * 0.32, platformY);
  flattenRange(width * 0.6, width * 0.78, height * 0.52);
  flattenRange(width * 0.42, width * 0.5, height * 0.62);
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
  buildTerrain();
  createWorms();
  updateHud();
  const worm = state.worms[state.currentIndex];
  if (worm) {
    sayComment("turn", { name: worm.name });
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
  buildWeaponList();
  if (!net.enabled) {
    resetGame();
  }
}

function updateHud() {
  const worm = state.worms[state.currentIndex];
  if (!worm || state.gameOver) {
    hudTurn.textContent = state.gameOver ? `Ganador: ${state.winner}` : "—";
    if (hudBadge) {
      hudBadge.textContent = state.gameOver ? "FIN" : "—";
      hudBadge.classList.remove("team-rojo", "team-azul");
    }
  } else {
    hudTurn.textContent = `${worm.name} · HP ${worm.health}`;
    if (hudBadge) {
      hudBadge.textContent = worm.team;
      hudBadge.classList.toggle("team-rojo", worm.team === "Rojo");
      hudBadge.classList.toggle("team-azul", worm.team === "Azul");
    }
  }
  const weapon = weapons[state.weaponIndex];
  hudWeapon.textContent = weapon ? weapon.name : "—";
  if (hudWind) hudWind.textContent = `${state.wind}`;
  hudPower.textContent = `${Math.round(state.charge * 100)}%`;
  powerFill.style.width = `${Math.round(state.charge * 100)}%`;
  powerBar.classList.toggle("charging", state.charging);
  syncWeaponList();
  updateTurnBanner();
}

function updateTurnBanner() {
  if (!turnBanner || !turnTeamLabel) return;
  const activeTeam = getActiveTeam();
  const isMyTurn = net.enabled && net.team && activeTeam === net.team;
  if (!net.enabled) {
    turnBanner.classList.remove("active", "team-rojo", "team-azul");
    turnBanner.style.opacity = "0";
    return;
  }
  if (isMyTurn) {
    turnTeamLabel.textContent = net.team;
    turnBanner.classList.add("active");
  } else {
    turnBanner.classList.remove("active");
  }
  turnBanner.classList.toggle("team-rojo", net.team === "Rojo");
  turnBanner.classList.toggle("team-azul", net.team === "Azul");
}

function buildWeaponList() {
  if (!weaponList) return;
  weaponList.innerHTML = "";
  weapons.forEach((weapon, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weapon-item";
    button.dataset.index = String(index);
    const key = document.createElement("span");
    key.className = "weapon-key";
    key.textContent = String(index + 1);
    const name = document.createElement("span");
    name.className = "weapon-name";
    name.textContent = weapon.name;
    button.appendChild(key);
    button.appendChild(name);
    button.addEventListener("click", () => {
      if (net.enabled) {
        if (!canApplyInput()) return;
        const code = `Digit${index + 1}`;
        sendNet({ type: "input", action: "keydown", code, key: code });
        return;
      }
      setWeapon(index);
    });
    li.appendChild(button);
    weaponList.appendChild(li);
  });
}

function syncWeaponList() {
  if (!weaponList) return;
  const locked = state.projectiles.length > 0 || state.charging || state.gameOver;
  weaponList.querySelectorAll("button").forEach((button) => {
    const index = Number(button.dataset.index);
    const isActive = index === state.weaponIndex;
    button.classList.toggle("active", isActive);
    button.disabled = locked;
  });
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

function sayComment(type, ctx = {}) {
  if (!commentaryEl || !commentaryText) return;
  const list = commentary[type] || commentary.fire;
  let text = list[Math.floor(Math.random() * list.length)];
  if (ctx.name) text = text.replaceAll("{name}", ctx.name);
  if (ctx.weapon) text = text.replaceAll("{weapon}", ctx.weapon);
  commentaryText.textContent = `"${text}"`;
  commentaryEl.classList.remove("commentary-pop");
  void commentaryEl.offsetWidth;
  commentaryEl.classList.add("commentary-pop");
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
  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  net.url = `${protocol}://${host}:8080`;
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

function updateAI(dt) {
  if (!aiConfig.enabled || state.gameOver || state.projectiles.length > 0 || state.charging) return;
  const worm = state.worms[state.currentIndex];
  if (!worm || !worm.alive || worm.team !== aiConfig.team) return;

  if (!state.aiPlan) {
    state.aiPlan = planShot(worm);
    state.aiTimer = rand(aiConfig.thinkDelayMin, aiConfig.thinkDelayMax);
    updateHud();
  }

  state.aiTimer -= dt;
  if (state.aiTimer <= 0 && state.aiPlan) {
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
  const weaponIndex = 0;
  const weapon = weapons[weaponIndex];
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

  for (let angle = angleStart; angle <= angleEnd; angle += aiConfig.angleStep) {
    for (let power = aiConfig.powerMin; power <= aiConfig.powerMax; power += aiConfig.powerStep) {
      const score = simulateShot(startX, startY, angle, power, weapon, targets);
      if (score < best.score) {
        best = { score, angle, power, weaponIndex };
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

  for (let t = 0; t < aiConfig.simMaxTime; t += aiConfig.simStep) {
    vy += gravity * aiConfig.simStep;
    x += vx * aiConfig.simStep;
    y += vy * aiConfig.simStep;

    if (x < -200 || x > state.width + 200 || y > state.height + 200) break;

    for (const target of targets) {
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
      if (dist <= config.wormRadius + 6) {
        return dist;
      }
    }

    if (y >= terrainHeightAt(x)) break;
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
  updateHud();
  sayComment("turn", { name: worm.name });
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

function drawWorm(worm, isCurrent) {
  if (!worm.alive) return;
  const shadowY = worm.y + config.wormRadius + 4;
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(worm.x, shadowY, config.wormRadius * 0.9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(
    worm.x - 4,
    worm.y - 6,
    2,
    worm.x,
    worm.y,
    config.wormRadius + 2
  );
  bodyGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  bodyGrad.addColorStop(0.4, worm.color);
  bodyGrad.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(worm.x, worm.y, config.wormRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f6f6f6";
  ctx.beginPath();
  ctx.arc(worm.x + 4, worm.y - 3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(worm.x + 5, worm.y - 3, 1.5, 0, Math.PI * 2);
  ctx.fill();

  const hpText = `${worm.health}`;
  ctx.font = "11px Trebuchet MS";
  ctx.textAlign = "center";
  const textWidth = ctx.measureText(hpText).width;
  const labelX = worm.x - textWidth / 2 - 6;
  const labelY = worm.y - config.wormRadius - 20;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(labelX, labelY, textWidth + 12, 14);
  ctx.fillStyle = "#f8f8fb";
  ctx.fillText(hpText, worm.x, labelY + 11);

  if (isCurrent && !state.gameOver) {
    const rad = (worm.angle * Math.PI) / 180;
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(worm.x, worm.y);
    ctx.lineTo(worm.x + Math.cos(rad) * 36, worm.y - Math.sin(rad) * 36);
    ctx.stroke();
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
  drawTerrain();
  drawTrajectory();
  state.worms.forEach((worm, index) => drawWorm(worm, index === state.currentIndex));
  drawProjectiles();
  drawExplosions();

  if (state.gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`Ganador: ${state.winner}`, state.width / 2, state.height / 2);
    ctx.font = "16px Trebuchet MS";
    ctx.fillText("Pulsa R para reiniciar", state.width / 2, state.height / 2 + 30);
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
  if (net.enabled) {
    updateExplosions(Math.min(0.033, dt));
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

function bindInput(phaserScene) {
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
}
