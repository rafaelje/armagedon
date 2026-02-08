import { jest } from '@jest/globals';

const mockClients = new Map();
const mockBroadcast = jest.fn();
const mockResetGame = jest.fn();
const mockHandleKeyDown = jest.fn();
const mockHandleKeyUp = jest.fn();
const mockGetActiveTeam = jest.fn();
const mockPressed = new Set();

jest.unstable_mockModule('../../src/server/state.ts', () => ({
  clients: mockClients,
  pressed: mockPressed,
  state: { seed: 123 },
  getNextClientId: () => 1
}));

jest.unstable_mockModule('../../src/server/broadcaster.ts', () => ({
  broadcast: mockBroadcast
}));

jest.unstable_mockModule('../../src/server/game-logic.ts', () => ({
  resetGame: mockResetGame,
  handleKeyDown: mockHandleKeyDown,
  handleKeyUp: mockHandleKeyUp,
  getActiveTeam: mockGetActiveTeam
}));

const { handleSocket } = (await import('../../src/server/network.ts')) as any;

describe("Network", () => {
  let socket: any;

  beforeEach(() => {
    mockClients.clear();
    mockBroadcast.mockClear();
    mockResetGame.mockClear();
    mockHandleKeyDown.mockClear();
    mockHandleKeyUp.mockClear();
    mockGetActiveTeam.mockClear();
    mockPressed.clear();

    socket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null
    };
  });

  it("should handle new connection", () => {
    handleSocket(socket);
    socket.onopen();
    expect(mockClients.has(socket)).toBe(true);
    expect(mockClients.get(socket).team).toBeDefined();
  });

  it("should handle join message", () => {
    handleSocket(socket);
    socket.onopen();

    socket.onmessage({ data: JSON.stringify({ type: "join" }) });

    expect(socket.send).toHaveBeenCalled(); // Welcome message
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "players" }));
  });

  it("should handle input message", () => {
    handleSocket(socket);
    socket.onopen();
    const team = mockClients.get(socket).team;
    mockGetActiveTeam.mockReturnValue(team); // Make it this player's turn

    socket.onmessage({ data: JSON.stringify({ type: "input", action: "keydown", code: "Space" }) });

    expect(mockHandleKeyDown).toHaveBeenCalledWith("Space");
    expect(mockPressed.has("Space")).toBe(true);
  });

  it("should ignore input if not active team", () => {
    handleSocket(socket);
    socket.onopen();
    const team = mockClients.get(socket).team;
    mockGetActiveTeam.mockReturnValue("OtherTeam");

    socket.onmessage({ data: JSON.stringify({ type: "input", action: "keydown", code: "Space" }) });

    expect(mockHandleKeyDown).not.toHaveBeenCalled();
  });

  it("should handle reset message", () => {
    handleSocket(socket);
    socket.onopen();

    socket.onmessage({ data: JSON.stringify({ type: "reset", seed: 999 }) });

    expect(mockResetGame).toHaveBeenCalled();
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "reset" }));
  });

  it("should handle close", () => {
    handleSocket(socket);
    socket.onopen();
    socket.onclose();

    expect(mockClients.has(socket)).toBe(false);
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "players" }));
  });
});
