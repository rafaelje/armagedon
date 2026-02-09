import {
  clamp,
  getAimBounds,
  createRng,
  seededRand,
  terrainHeightAt,
  makeWorm,
  updateWormPhysics,
  config,
  Worm
} from "../src/game.ts";

describe("Game Logic", () => {
  describe("clamp", () => {
    it("should clamp values within range", () => {
      expect(clamp(10, 0, 20)).toBe(10);
      expect(clamp(-5, 0, 20)).toBe(0);
      expect(clamp(25, 0, 20)).toBe(20);
    });
  });

  describe("getAimBounds", () => {
    it("should return correct bounds for Rojo", () => {
      expect(getAimBounds("Rojo")).toEqual({ min: -15, max: 165 });
    });
    it("should return correct bounds for Azul", () => {
      expect(getAimBounds("Azul")).toEqual({ min: 15, max: 195 });
    });
  });

  describe("RNG", () => {
    it("should be deterministic", () => {
      const rng1 = createRng(12345);
      const val1 = seededRand(rng1, 0, 100);
      const rng2 = createRng(12345);
      const val2 = seededRand(rng2, 0, 100);
      expect(val1).toBe(val2);
    });

    it("should produce different values for different seeds", () => {
        const rng1 = createRng(12345);
        const val1 = seededRand(rng1, 0, 100);
        const rng2 = createRng(67890);
        const val2 = seededRand(rng2, 0, 100);
        expect(val1).not.toBe(val2);
    });
  });

  describe("terrainHeightAt", () => {
    it("should return terrain height at index", () => {
      const terrain = [10, 20, 30];
      const width = 3;
      const height = 100;
      expect(terrainHeightAt(0, terrain, width, height)).toBe(10);
      expect(terrainHeightAt(1, terrain, width, height)).toBe(20);
      expect(terrainHeightAt(2, terrain, width, height)).toBe(30);
    });

    it("should clamp index", () => {
       const terrain = [10, 20, 30];
       expect(terrainHeightAt(-1, terrain, 3, 100)).toBe(10);
       expect(terrainHeightAt(5, terrain, 3, 100)).toBe(30);
    });

    it("should return default height if undefined", () => {
        const terrain: number[] = [];
        expect(terrainHeightAt(0, terrain, 3, 100)).toBe(100);
    });
  });

  describe("updateWorm", () => {
     let worm: Worm;
     let terrain: number[];
     let width = 1000;
     let height = 720;
     let pressed: Set<string>;

     beforeEach(() => {
         terrain = new Array(width).fill(500);
         worm = {
             id: 'w1',
             name: 'Test Worm',
             team: 'Rojo',
             color: '#ff0000',
             x: 100,
             y: 400,
             vx: 0,
             vy: 0,
             angle: 45,
             health: 100,
             alive: true,
             onGround: true
         };
         pressed = new Set<string>();
     });

     it("should move left when ArrowLeft is pressed", () => {
         pressed.add("ArrowLeft");
         const dt = 0.1;
         const initialX = worm.x;
         updateWormPhysics(worm, dt, true, pressed, terrain, width, height);
         expect(worm.x).toBeLessThan(initialX);
         expect(worm.x).toBeCloseTo(initialX - config.moveSpeed * dt);
     });

     it("should apply gravity when not on ground", () => {
         worm.onGround = false;
         const dt = 0.1;
         const initialVy = worm.vy;
         const initialY = worm.y;
         updateWormPhysics(worm, dt, true, pressed, terrain, width, height);
         expect(worm.vy).toBeGreaterThan(initialVy); // Gravity increases vy (downward)
         expect(worm.y).toBeGreaterThan(initialY); // y increases (downward)
     });

     it("should stop falling when hitting ground", () => {
         worm.onGround = false;
         // Terrain is at 500. GroundY = 500 - 12 = 488.
         worm.y = 480;
         worm.vy = 200;
         const dt = 0.5; // Will move past 488
         updateWormPhysics(worm, dt, true, pressed, terrain, width, height);

         expect(worm.onGround).toBe(true);
         expect(worm.y).toBe(488);
         expect(worm.vy).toBe(0);
     });
  });
});
