import { clients } from "./state.ts";

function broadcast(msg: any) {
  const data = JSON.stringify(msg);
  for (const socket of clients.keys()) {
    if ((socket as any).readyState === 1) { // WebSocket.OPEN is 1
      (socket as any).send(data);
    }
  }
}

export { broadcast };
