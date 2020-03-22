import { EmitEkt250TransformStream } from "../src/";
import {
  singleSuccess250,
  doubleSuccess250,
  singlePlusPartial250,
} from "../src/mockdata";

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
  test("that the stream can read a single ecard, and parse metadata first", async () => {
    const reader = createReadableStream(singleSuccess250)
      .pipeThrough(new EmitEkt250TransformStream(true))
      .getReader();

    const { value: metadata } = await reader.read();
    expect(metadata?.ecardNumber).toBe(208560);
    expect(metadata?.validEcardCheckByte).toBeTruthy();
    expect(metadata?.validTransferCheckByte).toBeFalsy();
    expect(metadata?.finishedReading).toBeFalsy();

    const { value: ecard } = await reader.read();
    expect(ecard?.ecardNumber).toBe(208560);
    expect(ecard?.validEcardCheckByte).toBeTruthy();
    expect(ecard?.validTransferCheckByte).toBeTruthy();
    expect(ecard?.finishedReading).toBeTruthy();

    reader.releaseLock();
  });
  test("that the stream can read four cards in a row", async () => {
    const fourCards = new Uint8Array(doubleSuccess250.byteLength * 2);
    fourCards.set(doubleSuccess250, 0);
    fourCards.set(doubleSuccess250, doubleSuccess250.byteLength);

    const reader = createReadableStream(fourCards)
      .pipeThrough(new EmitEkt250TransformStream(false))
      .getReader();

    const { value: ecard1 } = await reader.read();
    expect(ecard1?.ecardNumber).toBe(208560);
    expect(ecard1?.validTransferCheckByte).toBeTruthy();

    const { value: ecard2 } = await reader.read();
    expect(ecard2?.ecardNumber).toBe(206853);
    expect(ecard2?.validTransferCheckByte).toBeTruthy();

    const { value: ecard3 } = await reader.read();
    expect(ecard3?.ecardNumber).toBe(208560);
    expect(ecard3?.validTransferCheckByte).toBeTruthy();

    const { value: ecard4 } = await reader.read();
    expect(ecard4?.ecardNumber).toBe(206853);
    expect(ecard4?.validTransferCheckByte).toBeTruthy();

    reader.releaseLock();
  });
  test("that the stream can read four cards in a row, with failures in between", async () => {
    const fourPlusPartial = new Uint8Array(
      singlePlusPartial250.byteLength * 2 + doubleSuccess250.byteLength,
    );
    fourPlusPartial.set(singlePlusPartial250, 0);
    fourPlusPartial.set(singlePlusPartial250, singlePlusPartial250.byteLength);
    fourPlusPartial.set(doubleSuccess250, singlePlusPartial250.byteLength * 2);

    const reader = createReadableStream(fourPlusPartial)
      .pipeThrough(new EmitEkt250TransformStream(false))
      .getReader();

    const { value: ecard1 } = await reader.read();
    expect(ecard1?.ecardNumber).toBe(208560);
    expect(ecard1?.validTransferCheckByte).toBeTruthy();

    const { value: ecard2 } = await reader.read();
    expect(ecard2?.ecardNumber).toBe(208560);
    expect(ecard2?.validTransferCheckByte).toBeTruthy();

    const { value: ecard3 } = await reader.read();
    expect(ecard3?.ecardNumber).toBe(208560);
    expect(ecard3?.validTransferCheckByte).toBeTruthy();

    const { value: ecard4 } = await reader.read();
    expect(ecard4?.ecardNumber).toBe(206853);
    expect(ecard4?.validTransferCheckByte).toBeTruthy();

    reader.releaseLock();
  });
});
