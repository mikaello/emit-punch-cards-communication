import { vi } from "vitest";

vi.mock(
  "@mikaello/emit-punch-cards-communication",
  async () => import("../src"),
);

test("the MTR example releases the command writer before disconnecting", async () => {
  vi.stubGlobal("document", {
    querySelector: () => ({ disabled: false, addEventListener: () => {} }),
  });
  const writes: Uint8Array[] = [];
  let commandSent!: () => void;
  const sent = new Promise<void>((resolve) => {
    commandSent = resolve;
  });
  const writable = new WritableStream<Uint8Array>({
    write(bytes) {
      writes.push(bytes);
      commandSent();
    },
  });
  const port = {
    readable: new ReadableStream<Uint8Array>(),
    writable,
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {
      if (writable.locked)
        throw new Error("Cannot close a port with a locked writable stream");
    }),
  };
  vi.stubGlobal("navigator", { serial: { requestPort: async () => port } });
  try {
    const { connectMtr4, disconnectMtr4 } = await import("../example/helper");
    const connecting = connectMtr4();
    await sent;
    // Let the write promise settle before requesting disconnect.
    await Promise.resolve();
    await disconnectMtr4();
    await connecting;
    expect(writes.map((bytes) => Array.from(bytes))).toEqual([[47, 83, 84]]);
    expect(writable.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("the eScan2 example opens Web Serial and sends read-only commands", async () => {
  vi.stubGlobal("document", {
    querySelector: () => ({ disabled: false, addEventListener: () => {} }),
  });
  const writes: string[] = [];
  let statusSent!: () => void;
  const sent = new Promise<void>((resolve) => {
    statusSent = resolve;
  });
  const writable = new WritableStream<Uint8Array>({
    write(bytes) {
      writes.push(new TextDecoder().decode(bytes));
      statusSent();
    },
  });
  const port = {
    readable: new ReadableStream<Uint8Array>(),
    writable,
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {
      if (writable.locked) throw new Error("Writer lock still held");
    }),
  };
  vi.stubGlobal("navigator", { serial: { requestPort: async () => port } });
  try {
    const {
      connectEscan2,
      disconnectEscan2,
      spoolEscan2Today,
      spoolEscan2All,
      stopEscan2Spool,
    } = await import("../example/helper");
    const connecting = connectEscan2();
    await sent;
    await spoolEscan2Today();
    await spoolEscan2All();
    await stopEscan2Spool();
    await disconnectEscan2();
    await connecting;
    expect(port.open).toHaveBeenCalledWith({
      baudRate: 115200,
      dataBits: 8,
      stopBits: 1,
      parity: "none",
      flowControl: "none",
    });
    expect(writes).toEqual(["/ST\r\n", "/QM\r\n", "/QD\r\n", "/QS\r\n"]);
    expect(port.close).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
