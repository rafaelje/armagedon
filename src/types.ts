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

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  weaponId: string;
  explosionRadius: number;
  terrainRadius?: number;
  maxDamage: number;
  bounciness: number;
  fuse: number;
  timer: number;
  gravity: number;
  bounces: number;
  alive: boolean;
}

export interface GameState {
  width: number;
  height: number;
  terrain: number[];
  worms: Worm[];
  currentIndex: number;
  weaponIndex: number;
  projectiles: Projectile[];
  charging: boolean;
  charge: number;
  chargeDir: number;
  gameOver: boolean;
  winner: string | null;
  wind: number;
  seed: number;
  turnTimer: number;
  turnTimerMax: number;
  mapName?: string;
}
