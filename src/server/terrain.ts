import { clamp, createRng, seededRand } from "../game.js";

function flattenRange(terrain: number[], x0: number, x1: number, y: number, width: number) {
  const start = Math.floor(clamp(x0, 0, width));
  const end = Math.floor(clamp(x1, 0, width));
  for (let x = start; x <= end; x += 1) {
    terrain[x] = y;
  }
}

function smoothTerrain(terrain: number[], passes: number) {
  for (let p = 0; p < passes; p++) {
    const copy = [...terrain];
    for (let x = 1; x < terrain.length - 1; x++) {
      terrain[x] = (copy[x - 1] + copy[x] + copy[x + 1]) / 3;
    }
  }
}

function avgTerrainHeight(terrain: number[], x0: number, x1: number, defaultHeight: number) {
  let sum = 0;
  let count = 0;
  for (let x = x0; x <= x1; x++) {
    sum += terrain[x];
    count++;
  }
  return count > 0 ? sum / count : defaultHeight * 0.6;
}

function generateMapName(rng: () => number) {
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

function buildTerrain(width: number, height: number, seed: number) {
  const w = width;
  const h = height;
  const rng = createRng(seed || 1);
  const terrain = new Array(Math.floor(w) + 1);

  const base = seededRand(rng, h * 0.58, h * 0.75);

  const numWaves = Math.floor(seededRand(rng, 2, 6));
  const waves: { freq: number; amp: number; phase: number }[] = [];
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
    terrain[x] = y;
  }

  const numBumps = Math.floor(seededRand(rng, 0, 5));
  for (let i = 0; i < numBumps; i++) {
    const cx = seededRand(rng, w * 0.05, w * 0.95);
    const bw = seededRand(rng, 30, 130);
    const bh = seededRand(rng, -h * 0.14, h * 0.14);
    for (let x = 0; x <= w; x++) {
      const dx = (x - cx) / bw;
      if (Math.abs(dx) < 3) {
        terrain[x] += Math.exp(-dx * dx) * bh;
      }
    }
  }

  for (let x = 0; x <= w; x++) {
    terrain[x] = clamp(terrain[x], h * 0.4, h * 0.92);
  }

  smoothTerrain(terrain, 3);

  const numPlatforms = Math.floor(seededRand(rng, 0, 3));
  for (let i = 0; i < numPlatforms; i++) {
    const px = seededRand(rng, w * 0.35, w * 0.65);
    const pw = seededRand(rng, w * 0.04, w * 0.1);
    const ph = seededRand(rng, h * 0.45, h * 0.72);
    flattenRange(terrain, px - pw / 2, px + pw / 2, ph, w);
  }

  const leftAvg = avgTerrainHeight(terrain, Math.floor(w * 0.18), Math.floor(w * 0.32), h);
  const rightAvg = avgTerrainHeight(terrain, Math.floor(w * 0.68), Math.floor(w * 0.84), h);
  flattenRange(terrain, w * 0.18, w * 0.32, clamp(leftAvg, h * 0.43, h * 0.78), w);
  flattenRange(terrain, w * 0.68, w * 0.84, clamp(rightAvg, h * 0.43, h * 0.78), w);

  const mapName = generateMapName(rng);
  return { terrain, mapName };
}

export {
  buildTerrain,
  generateMapName,
  smoothTerrain,
  flattenRange,
  avgTerrainHeight
};
