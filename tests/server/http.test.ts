import { jest } from '@jest/globals';

const mockHandleSocket = jest.fn();
// Mock Deno global
(global as any).Deno = {
  upgradeWebSocket: jest.fn(() => ({ socket: {}, response: new Response() })),
  readFile: jest.fn(),
};

jest.unstable_mockModule('../../src/server/network.ts', () => ({
  handleSocket: mockHandleSocket
}));

const { handler } = (await import('../../src/server/http.ts')) as any;

describe("HTTP Handler", () => {
  beforeEach(() => {
    mockHandleSocket.mockClear();
    (global as any).Deno.upgradeWebSocket.mockClear();
    (global as any).Deno.readFile.mockClear();
  });

  it("should upgrade websocket requests", async () => {
    const req = new Request("http://localhost/", { headers: { upgrade: "websocket" } });
    await handler(req);
    expect((global as any).Deno.upgradeWebSocket).toHaveBeenCalled();
    expect(mockHandleSocket).toHaveBeenCalled();
  });

  it("should serve static files", async () => {
    const req = new Request("http://localhost/index.html");
    (global as any).Deno.readFile.mockResolvedValue(new Uint8Array([]));

    const res = await handler(req);

    expect((global as any).Deno.readFile).toHaveBeenCalledWith("./index.html");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
  });

  it("should serve index.html for root path", async () => {
    const req = new Request("http://localhost/");
    (global as any).Deno.readFile.mockResolvedValue(new Uint8Array([]));

    await handler(req);

    expect((global as any).Deno.readFile).toHaveBeenCalledWith("./index.html");
  });

  it("should return 404 for missing files", async () => {
    const req = new Request("http://localhost/assets/missing.png");
    (global as any).Deno.readFile.mockRejectedValue(new Error("File not found"));

    const res = await handler(req);

    expect(res.status).toBe(404);
  });
});
