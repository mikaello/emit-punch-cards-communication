import { EmitEkt250TransformStream } from "../src/";
import { singleSuccess250 } from "../src/mockdata";

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

describe("EmitEkt250TransformStream", () => {
  test("that the stream can read a single ecard", async () => {
    const reader = createReadableStream(singleSuccess250)
      .pipeThrough(new EmitEkt250TransformStream(false))
      .getReader();

    const { value: ecard } = await reader.read();
    reader.releaseLock();

    expect(ecard?.ecardNumber).toBe(208560);
    expect(ecard?.validEcardCheckByte).toBeTruthy();
    expect(ecard?.validTransferCheckByte).toBeTruthy();
  });
});
