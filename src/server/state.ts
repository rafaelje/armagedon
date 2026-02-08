import { GAME_WIDTH, GAME_HEIGHT, Worm } from "../game.js";

let seed = Math.floor(Math.random() * 1e9);
let nextId = 1;

export interface ClientInfo {
  id: string;
  team: string;
}

const clients = new Map<any, ClientInfo>();
const pressed = new Set<string>();

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  weaponId: string;
  explosionRadius: number;
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

const state: GameState = {
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

function getNextClientId() {
  return nextId++;
}

export {
  state,
  clients,
  pressed,
  getNextClientId
};
