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
  friction?: number;
  bounces: number;
  alive: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Hideout {
  type: "cave" | "overhang" | "trench";
  bounds: { x: number; y: number; width: number; height: number };
  sealed: boolean;
}

export interface LevelData {
  name: string;
  theme: string;
  waterLevel: number;
  worldBounds: { width: number; height: number };
  platformLeft: {
    terrain: Point[];
    hideouts: Hideout[];
    spawnPoints: Point[];
  };
  platformRight: {
    terrain: Point[];
    hideouts: Hideout[];
    spawnPoints: Point[];
  };
  gap: {
    startX: number;
    endX: number;
    floatingDebris?: { x: number; y: number; width: number; height: number }[];
  };
  decorations: { type: string; x: number; y: number }[];
  background: {
    skyColor: string;
    waterColor: string;
    waterSurfaceColor: string;
  };
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
  levelData?: LevelData;
}
