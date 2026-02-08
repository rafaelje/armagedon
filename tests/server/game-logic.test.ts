import { state } from "../../src/server/state.js";
import { resetGame, nextTurn } from "../../src/server/game-logic.js";

describe("Game Logic", () => {
    beforeEach(() => {
        state.width = 1000;
        state.height = 720;
        resetGame(12345);
    });

    describe("resetGame", () => {
        it("should initialize state", () => {
            expect(state.worms.length).toBeGreaterThan(0);
            expect(state.terrain.length).toBeGreaterThan(0);
            expect(state.gameOver).toBe(false);
            expect(state.currentIndex).toBe(0);
        });
    });

    describe("nextTurn", () => {
        it("should advance currentIndex", () => {
            const initialIndex = state.currentIndex;
            nextTurn();
            expect(state.currentIndex).not.toBe(initialIndex);
            expect(state.currentIndex).toBe((initialIndex + 1) % state.worms.length);
        });

        it("should skip dead worms", () => {
            if (state.worms.length > 2) {
                state.worms[1].alive = false;
                state.currentIndex = 0;
                nextTurn();
                expect(state.currentIndex).toBe(2);
            }
        });

        it("should declare game over if one team remains", () => {
            state.worms.forEach(w => {
                if(w.team === "Azul") w.alive = false;
            });
            nextTurn();
            expect(state.gameOver).toBe(true);
            expect(state.winner).toBe("Rojo");
        });
    });
});
