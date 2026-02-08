import { PORT, TICK_RATE, WIND_SCALE, GAME_WIDTH, GAME_HEIGHT, config, weapons } from "../../src/server/config.mjs";

describe("Config", () => {
  it("should export correct constants", () => {
    expect(PORT).toBeDefined();
    expect(TICK_RATE).toBe(30);
    expect(WIND_SCALE).toBe(20);
    expect(GAME_WIDTH).toBe(1280);
    expect(GAME_HEIGHT).toBe(720);
  });

  it("should export config object", () => {
    expect(config).toBeDefined();
    expect(config.gravity).toBe(900);
  });

  it("should export weapons array", () => {
    expect(Array.isArray(weapons)).toBe(true);
    expect(weapons.length).toBeGreaterThan(0);
  });
});
