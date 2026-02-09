export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export interface GameConfig {
  gravity: number;
  moveSpeed: number;
  angleSpeed: number;
  wormRadius: number;
  chargeRate: number;
  minWormDistance: number;
  knockbackImpulse: number;
  verticalBoost: number;
}

export const config: GameConfig = {
  gravity: 900,
  moveSpeed: 90,
  angleSpeed: 90,
  wormRadius: 12,
  chargeRate: 0.9,
  minWormDistance: 30,
  knockbackImpulse: 364, // 260 * 1.4
  verticalBoost: 280, // 200 * 1.4
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
  terrainRadius?: number;
  friction?: number;
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
    bounciness: 0.2,
    fuse: 6.6,
    gravityScale: 1.2,
    terrainRadius: 100,
    friction: 0.3,
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

import type { Worm, Circle } from "./types.ts";
export type { Worm };

export function isSolid(x: number, y: number, terrain: number[], holes: Circle[], width: number, height: number): boolean {
  if (x < 0 || x >= width || y < 0 || y >= height) return false;
  const xi = Math.floor(x);
  if (y < (terrain[xi] ?? height)) return false;

  if (holes && holes.length > 0) {
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      const dx = x - h.x;
      const dy = y - h.y;
      if (dx * dx + dy * dy < h.r * h.r) return false;
    }
  }
  return true;
}

export function getGroundAt(x: number, y: number, terrain: number[], holes: Circle[], width: number, height: number): number {
  const xi = Math.floor(clamp(x, 0, width - 1));
  const surfaceY = terrain[xi] ?? height;

  if (y <= surfaceY) return surfaceY;

  // If we are below the surface, check if there's air between us and the surface
  let hasAirAbove = false;
  const startCheckY = Math.min(Math.floor(y), height - 1);
  for (let cy = startCheckY; cy >= surfaceY; cy--) {
    if (!isSolid(x, cy, terrain, holes, width, height)) {
      hasAirAbove = true;
      break;
    }
  }

  if (!hasAirAbove) return surfaceY;

  // If there's air above us, we are in a cave or air gap. Search downwards for ground.
  for (let cy = Math.floor(y); cy < height; cy++) {
    if (isSolid(x, cy, terrain, holes, width, height)) return cy;
  }
  return height;
}

export function makeWorm(
  { id, name, team, color, x }: { id: string; name: string; team: string; color: string; x: number },
  terrain: number[],
  width: number,
  height: number,
  holes: Circle[] = []
): Worm {
  const y = getGroundAt(x, 0, terrain, holes, width, height) - config.wormRadius;
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
  pressed: Set<string>,
  terrain: number[],
  width: number,
  height: number,
  holes: Circle[] = []
): void {
  if (!worm.alive) return;

  if (canMove) {
    const left = pressed.has("ArrowLeft");
    const right = pressed.has("ArrowRight");
    const up = pressed.has("ArrowUp");
    const down = pressed.has("ArrowDown");

    if (left !== right) {
      const dir = left ? -1 : 1;
      const nextX = clamp(worm.x + dir * config.moveSpeed * dt, config.wormRadius, width - config.wormRadius);
      // Simple hill climbing
      const currentGround = getGroundAt(worm.x, worm.y + config.wormRadius - 2, terrain, holes, width, height);
      const nextGround = getGroundAt(nextX, worm.y + config.wormRadius - 10, terrain, holes, width, height);

      if (nextGround - currentGround < 15) { // Can climb small slopes
         worm.x = nextX;
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
    worm.x = clamp(worm.x, config.wormRadius, width - config.wormRadius);
    worm.vx *= worm.onGround ? 0.8 : 0.99;
  }

  const groundY = getGroundAt(worm.x, worm.y + config.wormRadius - 2, terrain, holes, width, height);
  const footY = worm.y + config.wormRadius;

  if (footY < groundY - 1) {
    worm.onGround = false;
  }

  if (!worm.onGround) {
    worm.vy += config.gravity * dt;
    worm.y += worm.vy * dt;
  }

  // Re-check ground after movement
  const finalGroundY = getGroundAt(worm.x, worm.y, terrain, holes, width, height);
  if (worm.y + config.wormRadius >= finalGroundY) {
    worm.y = finalGroundY - config.wormRadius;
    worm.vy = 0;
    worm.onGround = true;
  }
}
