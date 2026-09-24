import { EmitEkt250TransformStream, Mtr4TransformStream } from "../src";
import {
  singleSuccess250,
  doubleSuccess250,
  singlePartial250,
  singleSuccessMtr4,
  doubleSuccessMtr4,
  mtr4StatusMessage,
  spool2040cardsMtr4,
} from "../src/mockdata";

const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

async function readChunks<T>(
  chunks: Uint8Array[],
  transform: TransformStream<Uint8Array, T>,
): Promise<T[]> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const reader = source.pipeThrough(transform).getReader();
  const values: T[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) return values;
    values.push(value);
  }
}

for (const [name, single, double, factory] of [
  [
    "250",
    singleSuccess250,
    doubleSuccess250,
    () => new EmitEkt250TransformStream(),
  ],
  [
    "MTR4",
    singleSuccessMtr4,
    doubleSuccessMtr4,
    () => new Mtr4TransformStream(),
  ],
] as const) {
  describe(`${name} transport chunk boundaries`, () => {
    test("retains both captured cards in a single transport read", async () => {
      const values = await readChunks([double], factory());
      expect(values.map((v) => "ecardNumber" in v && v.ecardNumber)).toEqual([
        208560, 206853,
      ]);
      expect(values.every((v) => v.validTransferCheckByte)).toBe(true);
    });

    test("produces identical output at every split in a two-card capture", async () => {
      const expected = await readChunks(
        Array.from(double, (b) => Uint8Array.of(b)),
        factory(),
      );
      for (let split = 0; split <= double.length; split++) {
        expect(
          await readChunks(
            [double.slice(0, split), double.slice(split)],
            factory(),
          ),
          `split ${split}`,
        ).toEqual(expected);
      }
    });

    test("ignores empty reads after a completed frame", async () => {
      expect(
        await readChunks(
          [single, new Uint8Array(), new Uint8Array()],
          factory(),
        ),
      ).toHaveLength(1);
    });

    test("accepts a read larger than the internal buffer", async () => {
      const values = await readChunks(
        [concat(double, double, double, double)],
        factory(),
      );
      expect(values).toHaveLength(8);
      expect(values.every((v) => v.validTransferCheckByte)).toBe(true);
    });
  });
}

test("MTR4 reads mixed status and card messages in order", async () => {
  const values = await readChunks(
    [concat(mtr4StatusMessage, singleSuccessMtr4, mtr4StatusMessage)],
    new Mtr4TransformStream(),
  );
  expect(values.map((v) => v.packageType)).toEqual(["S", "M", "S"]);
  expect(values.every((v) => v.validTransferCheckByte)).toBe(true);
});

test("MTR4 reports an incomplete frame before its ring buffer wraps", async () => {
  const incomplete = new Uint8Array(702);
  incomplete.fill(0xff, 0, 4);
  await expect(
    readChunks([incomplete], new Mtr4TransformStream()),
  ).rejects.toThrow("Ring buffer overflow");
});

test("MTR4 preserves all messages in the recorded spool in one chunk", async () => {
  const values = await readChunks(
    [spool2040cardsMtr4],
    new Mtr4TransformStream(),
  );
  expect(values).toHaveLength(2040);
  expect(values.filter((v) => v.packageType === "M")).toHaveLength(1997);
  expect(values.filter((v) => v.packageType === "S")).toHaveLength(43);
  // 43 blocks have status headers but card-shaped tails and invalid checksums.
  // Preserve the decoder's failure flags, rather than treating them as cards.
  expect(values.filter((v) => !v.validTransferCheckByte)).toHaveLength(43);
  const frames = Array.from({ length: 2040 }, (_, i) =>
    spool2040cardsMtr4.slice(i * 234, (i + 1) * 234),
  );
  expect(values).toEqual(await readChunks(frames, new Mtr4TransformStream()));
});

test("250 resets early metadata after an interrupted card read", async () => {
  const values = await readChunks(
    [
      singlePartial250.slice(0, 60),
      singleSuccess250.slice(0, 10),
      singleSuccess250.slice(10),
    ],
    new EmitEkt250TransformStream(true),
  );
  expect(values.filter((v) => !v.finishedReading)).toHaveLength(2);
  expect(values.filter((v) => v.finishedReading)).toHaveLength(1);
});
