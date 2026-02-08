import { buildTerrain } from "../../src/server/terrain.ts";

describe("Terrain Generation", () => {
  it("should generate terrain array of correct length", () => {
    const width = 1000;
    const height = 720;
    const seed = 12345;
    const { terrain } = buildTerrain(width, height, seed);
    expect(terrain.length).toBe(width + 1);
  });

  it("should be deterministic based on seed", () => {
    const width = 1000;
    const height = 720;
    const seed = 12345;
    const { terrain: terrain1 } = buildTerrain(width, height, seed);
    const { terrain: terrain2 } = buildTerrain(width, height, seed);
    expect(terrain1).toEqual(terrain2);
  });

  it("should generate different terrain for different seeds", () => {
    const width = 1000;
    const height = 720;
    const { terrain: terrain1 } = buildTerrain(width, height, 12345);
    const { terrain: terrain2 } = buildTerrain(width, height, 67890);
    expect(terrain1).not.toEqual(terrain2);
  });

  it("should clamp terrain heights within reasonable bounds", () => {
      const width = 1000;
      const height = 720;
      const { terrain } = buildTerrain(width, height, 12345);
      terrain.forEach(y => {
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(height);
      });
  });
});
