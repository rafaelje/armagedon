import { state } from "../../src/server/state.mjs";
import { addProjectile, updateProjectiles, explode } from "../../src/server/physics.mjs";
import { buildTerrain } from "../../src/server/terrain.mjs";

describe("Physics", () => {
    beforeEach(() => {
        state.width = 1000;
        state.height = 720;
        state.projectiles = [];
        state.worms = [];
        const { terrain } = buildTerrain(state.width, state.height, 12345);
        state.terrain = terrain;
        state.wind = 0;
    });

    describe("addProjectile", () => {
        it("should add a projectile to state", () => {
            const p = { x: 10, y: 10, vx: 100, vy: 100, timer: 1 };
            addProjectile(p);
            expect(state.projectiles).toContain(p);
            expect(state.projectiles.length).toBe(1);
        });
    });

    describe("updateProjectiles", () => {
        it("should move projectiles based on velocity", () => {
            const p = { x: 100, y: 100, vx: 100, vy: 0, gravity: 0, timer: 1, alive: true };
            addProjectile(p);
            updateProjectiles(0.1);
            expect(state.projectiles[0].x).toBeCloseTo(110);
            expect(state.projectiles[0].y).toBeCloseTo(100);
        });

        it("should remove dead projectiles (timer <= 0)", () => {
             const p = { x: 100, y: 100, vx: 0, vy: 0, gravity: 0, timer: 0.1, alive: true, explosionRadius: 10, maxDamage: 10 };
             addProjectile(p);
             updateProjectiles(0.2);
             expect(state.projectiles.length).toBe(0);
        });

        it("should explode when hitting terrain", () => {
             for(let i=0; i<state.width; i++) state.terrain[i] = 500;
             const p = { x: 100, y: 510, vx: 0, vy: 100, gravity: 0, timer: 1, alive: true, explosionRadius: 10, maxDamage: 10 };
             addProjectile(p);
             updateProjectiles(0.1);
             expect(state.projectiles.length).toBe(0);
        });
    });

    describe("explode", () => {
        it("should damage worms within radius", () => {
            const worm = { x: 100, y: 100, health: 100, alive: true, vx: 0, vy: 0 };
            state.worms.push(worm);

            explode(100, 100, 50, 100);

            expect(worm.health).toBeLessThan(100);
        });

         it("should carve crater in terrain", () => {
            for(let i=0; i<state.width; i++) state.terrain[i] = 500;

            explode(100, 500, 20, 100);

            expect(state.terrain[100]).toBeGreaterThan(500);
        });
    });
});
