export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export interface GameConfig {
  gravity: number;
  moveSpeed: number;
  angleSpeed: number;
  wormRadius: number;
  chargeRate: number;
  minWormDistance: number;
}

export const config: GameConfig = {
  gravity: 900,
  moveSpeed: 90,
  angleSpeed: 90,
  wormRadius: 12,
  chargeRate: 0.9,
  minWormDistance: 30,
};

export interface Weapon {
  id: string;
  name: string;
  minSpeed: number;
  maxSpeed: number;
  explosionRadius: number;
  maxDamage: number;
  bounciness: number;
  fuse: number;
  gravityScale: number;
  projectileRadius?: number;
  burst?: number;
  burstSpread?: number;
  burstSpeedJitter?: number;
}

export const weapons: Weapon[] = [
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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getAimBounds(team: string): { min: number; max: number } {
  if (team === "Rojo") {
    return { min: -15, max: 165 };
  }
  if (team === "Azul") {
    return { min: 15, max: 195 };
  }
  return { min: 15, max: 165 };
}

export function createRng(seedValue: number): () => number {
  let t = seedValue >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRand(rng: () => number, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function terrainHeightAt(x: number, terrain: number[], width: number, height: number): number {
  const xi = Math.floor(clamp(x, 0, width - 1));
  return terrain[xi] ?? height;
}

export interface Worm {
  id: string;
  name: string;
  team: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  health: number;
  alive: boolean;
  onGround: boolean;
}

export function makeWorm(
  { id, name, team, color, x }: { id: string; name: string; team: string; color: string; x: number },
  terrain: number[],
  width: number,
  height: number
): Worm {
  const y = terrainHeightAt(x, terrain, width, height) - config.wormRadius;
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

export function updateWorm(
  worm: Worm,
  dt: number,
  canMove: boolean,
  pressed: Set<string> | any,
  terrain: number[],
  width: number,
  height: number
): void {
  if (!worm.alive) return;

  if (canMove) {
    const left = pressed.has("ArrowLeft");
    const right = pressed.has("ArrowRight");
    const up = pressed.has("ArrowUp");
    const down = pressed.has("ArrowDown");

    if (left !== right) {
      const dir = left ? -1 : 1;
      worm.x += dir * config.moveSpeed * dt;
      worm.x = clamp(worm.x, config.wormRadius, width - config.wormRadius);
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
    worm.x = clamp(worm.x, config.wormRadius, width - config.wormRadius);
    worm.vx *= worm.onGround ? 0.8 : 0.99;
  }

  const ground = terrainHeightAt(worm.x, terrain, width, height) - config.wormRadius;
  if (worm.y < ground - 1) {
    worm.onGround = false;
  }

  if (!worm.onGround) {
    worm.vy += config.gravity * dt;
    worm.y += worm.vy * dt;
  }

  const groundY = terrainHeightAt(worm.x, terrain, width, height) - config.wormRadius;
  if (worm.y >= groundY) {
    worm.y = groundY;
    worm.vy = 0;
    worm.onGround = true;
  }
}
