import { state, pressed } from "./state.mjs";
import { config, weapons } from "./config.mjs";
import { buildTerrain } from "./terrain.mjs";
import { updateProjectiles, fireProjectile } from "./physics.mjs";
import { makeWorm, updateWorm } from "../game.mjs";

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

  const { terrain, mapName } = buildTerrain(state.width, state.height, state.seed);
  state.terrain = terrain;
  state.mapName = mapName;

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
    updateWorm(worm, dt, isActive && state.projectiles.length === 0, pressed, state.terrain, state.width, state.height);
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
