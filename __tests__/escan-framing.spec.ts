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

test("preserves a multi-megabyte tag frame across large USB reads", () => {
  const unpacker = new EmitEscanUnpacker();
  const frames: unknown[] = [];
  const tagSize = 3 * 1024 * 1024;
  const tag = new Uint8Array(tagSize);
  tag.fill(0x41);
  tag[0] = 0x4e;
  tag[tagSize - 1] = 0x5a;
  const bytes = new Uint8Array(tagSize + 2);
  bytes[0] = 0x02;
  bytes.set(tag, 1);
  bytes[bytes.length - 1] = 0x03;

  const parseDumpTag = vi
    .spyOn(unpacker, "parseDumpTag")
    .mockImplementation((frame) => {
      expect(frame.length).toBe(tagSize);
      expect(frame[0]).toBe(0x4e);
      expect(frame[tagSize - 1]).toBe(0x5a);
      return {};
    });
  unpacker.onChunk = (frame) => frames.push(frame);
  unpacker.addBinaryData(bytes.subarray(0, 700_000));
  unpacker.addBinaryData(bytes.subarray(700_000, 2_000_000));
  unpacker.addBinaryData(bytes.subarray(2_000_000));
  expect(unpacker.data.byteLength).toBe(4000);
  unpacker.addBinaryData(encode(status(2)));

  expect(parseDumpTag).toHaveBeenCalledOnce();
  expect(frames).toMatchObject([{}, { serialNumber: "2" }]);
});

test("does not read stale bytes beyond the completed frame", () => {
  const first = status(1).replace(
    "\x03",
    `Z${"a".repeat(100)}\tA30-49-100\t\x03`,
  );
  const frames = collect([encode(first + status(2))]);
  expect(frames).toMatchObject([
    { serialNumber: "1", eScanBatteryPercentage: "100" },
    { serialNumber: "2", eScanBatteryPercentage: "" },
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
