import {
  getControlCodeInformation,
  ringBufferReadLength,
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

describe("ringBufferReadLength", () => {
  test("boundary", () => expect(ringBufferReadLength(10, 7, 2)).toBe(5));
  test("in the middle", () => expect(ringBufferReadLength(7, 2, 5)).toBe(3));
  test("at start", () => expect(ringBufferReadLength(7, 0, 5)).toBe(5));
});

describe("getRangeFromRingBuffer", () => {
  const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  test("getting from beginning", () => {
    expect(getRangeFromRingBuffer(buffer, 0, 4).toString()).toEqual("1,2,3,4");
  });
  test("getting from near end", () => {
    expect(getRangeFromRingBuffer(buffer, 6, 4).toString()).toEqual("7,8,1,2");
  });
  test("get nothing", () => {
    expect(getRangeFromRingBuffer(buffer, 6, 0).toString()).toHaveLength(0);
  });
});

describe("createUSBCommand", () => {
  const greenCommandBytes = [47, 71, 82, 69, 69, 78, 13, 10];

  test("returns correct for /GREEN command", () => {
    expect(createUSBCommand(USBCommand.GREEN).toString()).toEqual(
      greenCommandBytes.join(","),
    );
  });
});

describe("getByteIndexInNewRingbufferData", () => {
  const buffer = new Uint8Array([1, 3, 4, 5, 6, 7, 8, 9, 10]);
  test("returns null when byte is not", () => {
    const newBuffer = new Uint8Array([11, 12, 13]);
    expect(
      getByteIndexInNewRingbufferData(
        buffer.byteLength,
        buffer.byteLength - 2,
        newBuffer,
        USB_START_READ_BYTE,
      ),
    ).toBeNull();
  });

  test("returns correct position", () => {
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
