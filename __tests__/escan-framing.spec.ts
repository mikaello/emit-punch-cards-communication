import { EmitEscanUnpacker, EmitEscanTransformStream } from "../src";

// Synthetic ASCII status messages following the parser's existing wire format.
const status = (serial: number) =>
  `\x02IeScan-HW1-SW1-V0.16\tBS\tC250\tX0\tY${serial}\tU19.09.2026\tW12:34:56.789\t\x03\r\n`;
const encode = (text: string) => new TextEncoder().encode(text);
const collect = (chunks: Uint8Array[]) => {
  const unpacker = new EmitEscanUnpacker();
  const frames: unknown[] = [];
  unpacker.onChunk = (frame) => frames.push(frame);
  for (const chunk of chunks) unpacker.addBinaryData(chunk);
  return frames;
};

test("emits both status frames in a single USB read", () => {
  expect(collect([encode(status(1) + status(2))])).toMatchObject([
    { serialNumber: "1" },
    { serialNumber: "2" },
  ]);
});

test("preserves frames at every possible split of two messages", () => {
  const bytes = encode(status(1) + status(2));
  for (let i = 0; i <= bytes.length; i++) {
    expect(
      collect([bytes.slice(0, i), bytes.slice(i)]),
      `split ${i}`,
    ).toMatchObject([{ serialNumber: "1" }, { serialNumber: "2" }]);
  }
});

test("accepts a start delimiter at the last position of the old ring", () => {
  expect(collect([encode(" ".repeat(3999)), encode(status(1))])).toMatchObject([
    { serialNumber: "1" },
  ]);
});

test("accepts an end delimiter at the last position of the old ring", () => {
  const bytes = encode(status(1));
  const padding = 3999 - bytes.indexOf(3);
  expect(collect([encode(" ".repeat(padding)), bytes])).toMatchObject([
    { serialNumber: "1" },
  ]);
});

test("does not emit a frame twice when an extra ETX arrives", () => {
  expect(collect([encode(status(1)), Uint8Array.of(3)])).toHaveLength(1);
});

test("discards an interrupted frame when a new STX arrives", () => {
  expect(collect([encode("\x02Iunfinished" + status(2))])).toMatchObject([
    { serialNumber: "2" },
  ]);
});

test("processes a USB read larger than the old ring without losing frames", () => {
  const messages = Array.from({ length: 100 }, (_, i) => status(i)).join("");
  const frames = collect([encode(messages)]);
  expect(frames).toHaveLength(100);
  expect(frames).toMatchObject(
    Array.from({ length: 100 }, (_, i) => ({ serialNumber: String(i) })),
  );
});

test("buffers a single frame exceeding 4000 bytes", () => {
  // An uninterpreted text field exercises framing independently of field parsing.
  const bytes = encode(status(1).replace("\x03", `Z${"a".repeat(8000)}\t\x03`));
  expect(collect([bytes.slice(0, 4000), bytes.slice(4000)])).toMatchObject([
    { serialNumber: "1" },
  ]);
});

test("parses eScan status voltage, battery, and message fields", () => {
  const frame = status(1).replace("\tC250", "\tM12-3\tA30-49-+0-100\tC250");
  expect(collect([encode(frame)])).toMatchObject([
    {
      eScanBatteryVoltageMillivolt: "3000",
      eScanUsbVoltageMillivolt: "4900",
      eScanBatteryPercentage: "100",
      statusMessageAndEvent: "12-3",
    },
  ]);
});

test("parses the status voltage field without the optional charge value", () => {
  const frame = status(1).replace("\tC250", "\tA30-49-100\tC250");
  expect(collect([encode(frame)])).toMatchObject([
    {
      eScanBatteryVoltageMillivolt: "3000",
      eScanUsbVoltageMillivolt: "4900",
      eScanBatteryPercentage: "100",
    },
  ]);
});

test("the TransformStream preserves coalesced status messages", async () => {
  const source = new ReadableStream<ArrayBuffer>({
    start(controller) {
      controller.enqueue(encode(status(1) + status(2)).buffer);
      controller.close();
    },
  });
  const reader = source.pipeThrough(new EmitEscanTransformStream()).getReader();
  const frames = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    frames.push(value);
  }
  expect(frames).toMatchObject([{ serialNumber: "1" }, { serialNumber: "2" }]);
});
