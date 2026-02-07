import { handleSocket } from "./network.mjs";

function getContentType(path) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function handler(req) {
  const url = new URL(req.url);

  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleSocket(socket);
    return response;
  }

  let path = url.pathname;
  if (path === "/") path = "/index.html";

  try {
    const filePath = "." + path;
    const file = await Deno.readFile(filePath);
    const contentType = getContentType(path);
    return new Response(file, { headers: { "content-type": contentType } });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

export { handler };
