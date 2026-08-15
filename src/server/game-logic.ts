import { state, pressed } from "./state.ts";
import { config, weapons } from "./config.ts";
import { buildTerrain } from "./terrain.ts";
import { updateProjectiles, fireProjectile } from "./physics.ts";
import { makeWorm, updateWormPhysics, clamp } from "../game.ts";
import type { Worm } from "../game.ts";
import type { LevelData, Point } from "../types.ts";
import defaultLevel from "../levels/tropical_island.ts";

function getYOnPolygon(x: number, points: Point[]): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x)) {
      if (Math.abs(p2.x - p1.x) < 0.001) return p1.y;
      const t = (x - p1.x) / (p2.x - p1.x);
      return p1.y + t * (p2.y - p1.y);
    }
  }
  return null;
}

function buildTerrainFromLevel(level: LevelData) {
  const w = state.width;
  const h = state.height;
  state.terrain = new Array(Math.floor(w) + 1);
  state.holes = [];

  for (let x = 0; x <= w; x++) {
    const realX = (x / w) * level.worldBounds.width;
    let y = level.waterLevel;

    const leftY = getYOnPolygon(realX, level.platformLeft.terrain);
    const rightY = getYOnPolygon(realX, level.platformRight.terrain);

    if (leftY !== null) y = leftY;
    if (rightY !== null) y = rightY;

    state.terrain[x] = (y / level.worldBounds.height) * h;
  }

  // Add initial hideouts as holes
  [...level.platformLeft.hideouts, ...level.platformRight.hideouts].forEach(hideout => {
    if (hideout.type === "cave" || hideout.type === "overhang") {
       const cx = (hideout.bounds.x + hideout.bounds.width / 2) / level.worldBounds.width * w;
       const cy = (hideout.bounds.y + hideout.bounds.height / 2) / level.worldBounds.height * h;
       const r = (Math.max(hideout.bounds.width, hideout.bounds.height) / 2) / level.worldBounds.width * w;
       state.holes.push({ x: cx, y: cy, r: r });
    }
  });
}

function createWorms() {
  const worms: Worm[] = [];

  if (defaultLevel) {
    const w = state.width;
    const lw = defaultLevel.worldBounds.width;

    defaultLevel.platformLeft.spawnPoints.forEach((p, index) => {
      worms.push(makeWorm({
        id: `R${index + 1}`,
        name: `Rojo ${index + 1}`,
        team: "Rojo",
        color: "#ef476f",
        x: (p.x / lw) * w,
      }, state.terrain, state.width, state.height, state.holes));
    });

    defaultLevel.platformRight.spawnPoints.forEach((p, index) => {
      worms.push(makeWorm({
        id: `A${index + 1}`,
        name: `Azul ${index + 1}`,
        team: "Azul",
        color: "#118ab2",
        x: (p.x / lw) * w,
      }, state.terrain, state.width, state.height, state.holes));
    });
  } else {
    const left = [state.width * 0.2, state.width * 0.3];
    const right = [state.width * 0.7, state.width * 0.82];

    left.forEach((x, index) => {
      worms.push(makeWorm({
        id: `R${index + 1}`,
        name: `Rojo ${index + 1}`,
        team: "Rojo",
        color: "#ef476f",
        x,
      }, state.terrain, state.width, state.height));
    });

    right.forEach((x, index) => {
      worms.push(makeWorm({
        id: `A${index + 1}`,
        name: `Azul ${index + 1}`,
        team: "Azul",
        color: "#118ab2",
        x,
      }, state.terrain, state.width, state.height));
    });
  }

  state.worms = worms;
  state.currentIndex = 0;
}

function resetGame(seedOverride?: number) {
  if (seedOverride !== undefined && Number.isFinite(seedOverride)) {
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
  state.holes = [];

  if (defaultLevel) {
    buildTerrainFromLevel(defaultLevel);
    state.mapName = defaultLevel.name;
  } else {
    const { terrain, mapName } = buildTerrain(state.width, state.height, state.seed);
    state.terrain = terrain;
    state.mapName = mapName;
  }

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

function updateCharge(dt: number) {
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

function handleKeyDown(code: string) {
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

function handleKeyUp(code: string) {
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

function step(dt: number) {
  if (state.gameOver) return;
  state.worms.forEach((worm, index) => {
    const isActive = index === state.currentIndex && worm.alive;
    updateWormPhysics(worm, dt, isActive && state.projectiles.length === 0, pressed, state.terrain, state.width, state.height, state.holes);
  });

  const wasProjectilesEmpty = state.projectiles.length === 0;
  updateProjectiles(dt);

  if (!wasProjectilesEmpty && state.projectiles.length === 0) {
    nextTurn();
  }

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

export {
  resetGame,
  step,
  handleKeyDown,
  handleKeyUp,
  getActiveTeam,
  createWorms,
  nextTurn
};
