import { jest } from '@jest/globals';

// Mock state module before importing broadcaster
const mockClients = new Map();
jest.unstable_mockModule('../../src/server/state.js', () => ({
  clients: mockClients
}));

// Import the module under test
const { broadcast } = await import('../../src/server/broadcaster.js');

describe("Broadcaster", () => {
  beforeEach(() => {
    mockClients.clear();
  });

  it("should send message to all open clients", () => {
    const sendMock1 = jest.fn();
    const sendMock2 = jest.fn();

    // Mock WebSocket objects
    const socket1 = { readyState: 1, send: sendMock1 }; // OPEN = 1
    const socket2 = { readyState: 1, send: sendMock2 };

    mockClients.set(socket1, {});
    mockClients.set(socket2, {});

    const msg = { type: "test" };
    broadcast(msg);

    const expectedData = JSON.stringify(msg);
    expect(sendMock1).toHaveBeenCalledWith(expectedData);
    expect(sendMock2).toHaveBeenCalledWith(expectedData);
  });

  it("should not send message to closed clients", () => {
    const sendMock = jest.fn();
    const socket = { readyState: 3, send: sendMock }; // CLOSED = 3

    mockClients.set(socket, {});

    broadcast({ type: "test" });

    expect(sendMock).not.toHaveBeenCalled();
  });
});
