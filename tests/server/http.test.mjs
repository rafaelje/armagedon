import { jest } from '@jest/globals';

const mockHandleSocket = jest.fn();
// Mock Deno global
global.Deno = {
  upgradeWebSocket: jest.fn(() => ({ socket: {}, response: new Response() })),
  readFile: jest.fn(),
};

jest.unstable_mockModule('../../src/server/network.mjs', () => ({
  handleSocket: mockHandleSocket
}));

const { handler } = await import('../../src/server/http.mjs');

describe("HTTP Handler", () => {
  beforeEach(() => {
    mockHandleSocket.mockClear();
    Deno.upgradeWebSocket.mockClear();
    Deno.readFile.mockClear();
  });

  it("should upgrade websocket requests", async () => {
    const req = new Request("http://localhost/", { headers: { upgrade: "websocket" } });
    await handler(req);
    expect(Deno.upgradeWebSocket).toHaveBeenCalled();
    expect(mockHandleSocket).toHaveBeenCalled();
  });

  it("should serve static files", async () => {
    const req = new Request("http://localhost/index.html");
    Deno.readFile.mockResolvedValue(new Uint8Array([]));

    const res = await handler(req);

    expect(Deno.readFile).toHaveBeenCalledWith("./index.html");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
  });

  it("should serve index.html for root path", async () => {
    const req = new Request("http://localhost/");
    Deno.readFile.mockResolvedValue(new Uint8Array([]));

    await handler(req);

    expect(Deno.readFile).toHaveBeenCalledWith("./index.html");
  });

  it("should return 404 for missing files", async () => {
    const req = new Request("http://localhost/missing.png");
    Deno.readFile.mockRejectedValue(new Error("File not found"));

    const res = await handler(req);

    expect(res.status).toBe(404);
  });
});
