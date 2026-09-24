import { vi } from "vitest";

vi.mock(
  "@mikaello/emit-punch-cards-communication",
  async () => import("../src"),
);

test("the MTR example releases the command writer before disconnecting", async () => {
  const buttons = new Map<
    string,
    { disabled: boolean; onclick?: () => unknown }
  >();
  vi.stubGlobal("document", {
    querySelector: (selector: string) => {
      if (selector === "#output") return { textContent: "" };
      if (!buttons.has(selector)) buttons.set(selector, { disabled: false });
      return buttons.get(selector);
    },
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
    await import("../example/main.js");
    const connecting = buttons.get("#connect-mtr4")!.onclick!();
    await sent;
    // Let the write promise settle before requesting disconnect.
    await Promise.resolve();
    await buttons.get("#disconnect-mtr4")!.onclick!();
    await connecting;
    expect(writes.map((bytes) => Array.from(bytes))).toEqual([[47, 83, 84]]);
    expect(writable.locked).toBe(false);
    expect(port.close).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
