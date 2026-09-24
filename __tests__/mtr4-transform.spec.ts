import { Mtr4TransformStream } from "../src";
import {
  singleSuccessMtr4,
  doubleSuccessMtr4,
  mtr4StatusMessage,
} from "../src/mockdata";
import { EcardMtr, MtrStatusMessage } from "../src/transform-stream-mtr4";
import { PackageType } from "./../src/transform-stream-utils";

/**
 * Creates a `ReadableStream` from an `Uint8Array`, useful for testing with mockdata
 */
const createReadableStream = (dataToBeStreamable: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (let byte of dataToBeStreamable) {
        controller.enqueue(Uint8Array.from([byte]));
      }
    },
  });

describe("Mtr4TransformStream", () => {
  test("logs the combined byte count and a pasteable array after traffic stops", async () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const stream = new Mtr4TransformStream({ logRawDataAfterIdle: true });
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      const finished = reader.read();

      await writer.write(Uint8Array.of(255, 254));
      await vi.advanceTimersByTimeAsync(3000);
      await writer.write(Uint8Array.of(0, 1));
      await vi.advanceTimersByTimeAsync(4999);
      expect(log).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(log.mock.calls).toEqual([
        ["Number of bytes in this reading: 4"],
        ["new Uint8Array([255,254,0,1])"],
      ]);

      await writer.close();
      await finished;
    } finally {
      log.mockRestore();
      vi.useRealTimers();
    }
  });

  test("prints pending raw data when the stream closes", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const stream = new Mtr4TransformStream({ logRawDataAfterIdle: true });
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      const finished = reader.read();

      await writer.write(Uint8Array.of(1, 2));
      await writer.close();
      await finished;
      expect(log.mock.calls).toEqual([
        ["Number of bytes in this reading: 2"],
        ["new Uint8Array([1,2])"],
      ]);
    } finally {
      log.mockRestore();
    }
  });

  test("exposes raw chunks for diagnostics without letting the callback alter parsing", async () => {
    const input = singleSuccessMtr4.slice();
    const rawChunks: Uint8Array[] = [];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(input);
        controller.close();
      },
    });
    const reader = source
      .pipeThrough(
        new Mtr4TransformStream({
          onRawData(bytes) {
            rawChunks.push(bytes.slice());
            bytes[0] = 0;
          },
        }),
      )
      .getReader();

    const { value } = await reader.read();
    expect(rawChunks).toEqual([singleSuccessMtr4]);
    expect(input[0]).toBe(255);
    expect(value?.packageType).toBe(PackageType.EcardMtr);
    reader.releaseLock();
  });

  test("that the stream can read a single ecard", async () => {
    const reader = createReadableStream(singleSuccessMtr4)
      .pipeThrough(new Mtr4TransformStream())
      .getReader();

    const { value } = await reader.read();
    reader.releaseLock();

    const ecard = value as EcardMtr;

    expect(ecard.packageType).toBe(PackageType.EcardMtr);
    expect(ecard.ecardNumber).toBe(208560);
    expect(ecard.validTransferCheckByte).toBeTruthy();
  });

  test("that the stream can read two ecards", async () => {
    const reader = createReadableStream(doubleSuccessMtr4)
      .pipeThrough(new Mtr4TransformStream())
      .getReader();

    const { value: ecard_1 } = await reader.read();
    const { value: ecard_2 } = await reader.read();
    reader.releaseLock();

    const ecard1 = ecard_1 as EcardMtr;
    const ecard2 = ecard_2 as EcardMtr;

    expect(ecard1.packageType).toBe(PackageType.EcardMtr);
    expect(ecard1.ecardNumber).toBe(208560);
    expect(ecard1.validTransferCheckByte).toBeTruthy();

    expect(ecard2.packageType).toBe(PackageType.EcardMtr);
    expect(ecard2.ecardNumber).toBe(206853);
    expect(ecard2.validTransferCheckByte).toBeTruthy();
  });

  test("that the stream can read a status message", async () => {
    const reader = createReadableStream(mtr4StatusMessage)
      .pipeThrough(new Mtr4TransformStream())
      .getReader();

    const { value } = await reader.read();
    reader.releaseLock();

    const ecard = value as MtrStatusMessage;

    expect(ecard.packageType).toBe(PackageType.StatusMessage);
    expect(ecard.mtrId).toBe(14209);
    expect(ecard.validTransferCheckByte).toBeTruthy();
  });
});
