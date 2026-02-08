import { clients } from "./state.mjs";

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const socket of clients.keys()) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  }
}

export { broadcast };
