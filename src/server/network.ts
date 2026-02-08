import { state, clients, pressed, getNextClientId, GameState } from "./state.js";
import { resetGame, getActiveTeam, handleKeyDown, handleKeyUp } from "./game-logic.js";
import { broadcast } from "./broadcaster.js";

function snapshot(full = false) {
  const snap: Partial<GameState> = {
    width: state.width,
    height: state.height,
    seed: state.seed,
    worms: state.worms,
    currentIndex: state.currentIndex,
    weaponIndex: state.weaponIndex,
    projectiles: state.projectiles,
    charging: state.charging,
    charge: state.charge,
    gameOver: state.gameOver,
    winner: state.winner,
    wind: state.wind,
    turnTimer: state.turnTimer,
    turnTimerMax: state.turnTimerMax,
  };
  if (full) {
    snap.terrain = state.terrain;
  }
  return snap;
}

function broadcastState(full = false) {
  broadcast({ type: "state", state: snapshot(full) });
}

function teamCounts() {
  const counts = { Rojo: 0, Azul: 0 };
  for (const info of clients.values()) {
    if (info.team === "Rojo") counts.Rojo += 1;
    if (info.team === "Azul") counts.Azul += 1;
  }
  return counts;
}

function assignTeam() {
  const counts = teamCounts();
  if (counts.Rojo === 0) return "Rojo";
  if (counts.Azul === 0) return "Azul";
  return "Spectator";
}

function broadcastPlayers() {
  const players = Array.from(clients.values()).map(({ id, team }) => ({ id, team }));
  broadcast({ type: "players", players });
}

function handleSocket(socket: any) {
  socket.onopen = () => {
    const id = `p${getNextClientId()}`;
    const team = assignTeam();
    clients.set(socket, { id, team });
  };

  socket.onmessage = (event: any) => {
    let msg = null;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    if (msg.type === "join") {
      const clientInfo = clients.get(socket);
      if (!clientInfo) return;
      const { id, team } = clientInfo;

      socket.send(JSON.stringify({ type: "welcome", id, team, seed: state.seed, state: snapshot(true) }));
      broadcastPlayers();
      return;
    }

    if (msg.type === "input") {
      const clientInfo = clients.get(socket);
      if (!clientInfo) return;
      const { team } = clientInfo;

      if (team === "Spectator") return;
      if (team !== getActiveTeam()) return;
      if (msg.action === "keydown") {
        pressed.add(msg.code);
        handleKeyDown(msg.code);
      } else if (msg.action === "keyup") {
        pressed.delete(msg.code);
        handleKeyUp(msg.code);
      }
      return;
    }

    if (msg.type === "reset") {
      const incomingSeed = Number(msg.seed);
      const seed = Number.isFinite(incomingSeed) ? Math.floor(incomingSeed) : Math.floor(Math.random() * 1e9);
      resetGame(seed);
      broadcast({ type: "reset", state: snapshot(true) });
    }
  };

  socket.onclose = () => {
    clients.delete(socket);
    broadcastPlayers();
  };

  socket.onerror = (e: any) => {
    console.error("WebSocket error:", e);
    if (socket.readyState !== 1) { // 1 is WebSocket.OPEN
        clients.delete(socket);
    }
  };
}

export {
  handleSocket,
  broadcastState
};
