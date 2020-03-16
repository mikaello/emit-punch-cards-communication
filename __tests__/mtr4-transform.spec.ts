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
