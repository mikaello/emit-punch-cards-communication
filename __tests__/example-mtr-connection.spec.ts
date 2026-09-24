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
