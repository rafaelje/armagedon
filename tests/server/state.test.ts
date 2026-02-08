import { state, clients, pressed, getNextClientId } from "../../src/server/state.js";

describe("State", () => {
  it("should initialize state object correctly", () => {
    expect(state.width).toBe(1280);
    expect(state.height).toBe(720);
    expect(state.worms).toEqual([]);
    expect(state.projectiles).toEqual([]);
    expect(state.gameOver).toBe(false);
  });

  it("should initialize clients map", () => {
    expect(clients).toBeInstanceOf(Map);
  });

  it("should initialize pressed set", () => {
    expect(pressed).toBeInstanceOf(Set);
  });

  it("should generate unique client IDs", () => {
    const id1 = getNextClientId();
    const id2 = getNextClientId();
    expect(id1).toBeLessThan(id2);
  });
});
