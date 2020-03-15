import { Mtr4TransformStream } from "../src";
import { singleSuccessMtr4, mtr4StatusMessage } from "../src/mockdata";
import { PackageType, EcardMtr } from "../src/transform-stream-mtr4";

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
  test("that the stream can read a single ecard", async () => {
    const reader = createReadableStream(singleSuccessMtr4)
      .pipeThrough(new Mtr4TransformStream())
      .getReader();

    const { value } = await reader.read();
    reader.releaseLock();

    const ecard = value as EcardMtr;

    expect(ecard.ecardNumber).toBe(208560);
    expect(ecard.validTransferCheckByte).toBeTruthy();
  });
});
