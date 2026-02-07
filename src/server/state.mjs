import { GAME_WIDTH, GAME_HEIGHT } from "../game.mjs";

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

function getNextClientId() {
  return nextId++;
}

export {
  state,
  clients,
  pressed,
  getNextClientId
};
