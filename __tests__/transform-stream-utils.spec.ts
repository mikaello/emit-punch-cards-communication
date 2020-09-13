import {
  getControlCodeInformation,
  checkForNewReadPosition,
  ringBufferReadLength,
  addToRingBuffer,
  getRangeFromRingBuffer,
  getByteIndexInNewRingbufferData,
  USB_START_READ_BYTE,
} from "../src/transform-stream-utils";
import { createUSBCommand, USBCommand } from "../src/escan-commands";

describe.skip("getControlCodeInformation", () => {
  test("control code information", () => {
    // TODO: write this test
    const dv = new DataView(new Uint8Array(0).buffer);
    expect(getControlCodeInformation(dv)).toBeFalsy();
  });
});

describe("checkForNewReadPosition", () => {
  const buffer = [0xff, 1, 7, 0xff, 0xff, 0xff, 2, 7, 0xff, 0xff];
  const dataView = new DataView(new Uint8Array(buffer).buffer);
  test("no new read position", () =>
    expect(checkForNewReadPosition(3, dataView, 6, 4)).toBeNull());
  test("new read position at start", () =>
    expect(checkForNewReadPosition(3, dataView, 8, 4)).toBe(8));
  test("new read position at start of back-check", () =>
    expect(checkForNewReadPosition(2, dataView, 0, 1)).toBe(9));
  test("new read position in the middle", () =>
    expect(checkForNewReadPosition(2, dataView, 2, 4)).toBe(4));
});

describe("ringBufferReadLength", () => {
  test("boundary", () => expect(ringBufferReadLength(10, 7, 2)).toBe(5));
  test("in the middle", () => expect(ringBufferReadLength(7, 2, 5)).toBe(3));
  test("at start", () => expect(ringBufferReadLength(7, 0, 5)).toBe(5));
});

describe("addToRingBuffer", () => {
  const data = new Uint8Array([9, 9, 9]);

  test("add data at boundary", () => {
    const offset = 0;
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const newBuffer = new Uint8Array([9, 9, 9, 4, 5, 6, 7, 8]);

    const newOffset = addToRingBuffer(buffer, data, offset);
    expect(newOffset).toBe(3);
    expect(buffer.toString()).toEqual(newBuffer.toString());
  });

  test("add data at boundary", () => {
    const offset = 6;
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const newBuffer = new Uint8Array([9, 2, 3, 4, 5, 6, 9, 9]);

    const newOffset = addToRingBuffer(buffer, data, offset);
    expect(newOffset).toBe(1);
    expect(buffer.toString()).toEqual(newBuffer.toString());
  });
  test("add nothing", () => {
    const offset = 6;
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const bufferString = buffer.toString();

    const newOffset = addToRingBuffer(buffer, new Uint8Array([]), offset);
    expect(newOffset).toBe(offset);
    expect(buffer.toString()).toEqual(bufferString);
  });
});

describe("getRangeFromRingBuffer", () => {
  const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  test("getting from beginning", () => {
    expect(getRangeFromRingBuffer(buffer, 0, 4).toString()).toEqual("1,2,3,4");
  });
  test("getting from near end", () => {
    expect(getRangeFromRingBuffer(buffer, 6, 4).toString()).toEqual("7,8,1,2");
  });
  test("getting nothing should return nothing", () => {
    expect(getRangeFromRingBuffer(buffer, 6, 0).toString()).toHaveLength(0);
  });
});

describe("createUSBCommand", () => {
  const greenCommandBytes = [47, 71, 82, 69, 69, 78, 13, 10];

  test("returns correct bytes for /GREEN command", () => {
    expect(createUSBCommand(USBCommand.GREEN).toString()).toEqual(
      greenCommandBytes.join(","),
    );
  });
});

describe("getByteIndexInNewRingbufferData", () => {
  const buffer = new Uint8Array([1, 3, 4, 5, 6, 7, 8, 9, 10]);
  test("returns null when interesting byte is not present", () => {
    const newBuffer = new Uint8Array([11, 12, 13]);
    expect(
      getByteIndexInNewRingbufferData(
        buffer.byteLength,
        buffer.byteLength - 2,
        newBuffer,
        USB_START_READ_BYTE, // is not present
      ),
    ).toBeNull();
  });

  test("returns correct position of interesting byte", () => {
    const newBuffer = new Uint8Array([0, 7, 9, 8, 7, USB_START_READ_BYTE]);
    expect(
      getByteIndexInNewRingbufferData(
        buffer.byteLength,
        buffer.byteLength - 2,
        newBuffer,
        USB_START_READ_BYTE,
      ),
    ).toEqual(4);
  });
});
