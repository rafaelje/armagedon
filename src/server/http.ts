import { handleSocket } from "./network.js";

function getContentType(path: string) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // @ts-ignore
  if (req.headers.get("upgrade") === "websocket") {
    // @ts-ignore
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleSocket(socket);
    return response;
  }

  let pathName = url.pathname;
  if (pathName === "/") pathName = "/index.html";

  // Security: restrict serving to specific directories
  const allowedPrefixes = ["/index.html", "/dist/", "/assets/", "/src/style.css"];
  const isAllowed = allowedPrefixes.some(p => pathName.startsWith(p) || pathName === p);

  if (!isAllowed) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const filePath = "." + pathName;
    // @ts-ignore
    const file = await Deno.readFile(filePath);
    const contentType = getContentType(pathName);
    return new Response(file, { headers: { "content-type": contentType } });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

export { handler };
