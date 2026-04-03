import {
  bytesToInt,
  bytesToDate,
  checkControlCode,
} from "../src/byteHandlingUtils";

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("bytesToInt", () => {
  test("converts 1 byte", () => {
    expect(bytesToInt(dv([0x42]))).toBe(0x42);
  });

  test("converts 2 bytes little-endian", () => {
    expect(bytesToInt(dv([0x01, 0x00]))).toBe(1);
    expect(bytesToInt(dv([0x00, 0x01]))).toBe(256);
  });

  test("converts 3 bytes little-endian (ecard number format)", () => {
    // ecard 208560 = 0x32EB0 → bytes [0xB0, 0x2E, 0x03]
    expect(bytesToInt(dv([0xb0, 0x2e, 0x03]))).toBe(208560);
  });

  test("converts 4 bytes little-endian", () => {
    expect(bytesToInt(dv([0x01, 0x00, 0x00, 0x00]))).toBe(1);
    expect(bytesToInt(dv([0xff, 0xff, 0xff, 0x7f]))).toBe(0x7fffffff);
  });

  test("converts 0 bytes to 0", () => {
    expect(bytesToInt(dv([]))).toBe(0);
  });

  test("returns unsigned value for high-bit input", () => {
    expect(bytesToInt(dv([0xff, 0xff, 0xff, 0xff]))).toBe(0xffffffff);
  });

  test("throws for views larger than 4 bytes", () => {
    expect(() => bytesToInt(dv([1, 2, 3, 4, 5]))).toThrow();
  });
});

describe("bytesToDate", () => {
  test("converts a 2000s date (year byte < 90)", () => {
    // year=26 → 2026, month=4, day=3, hour=10, min=30, sec=0
    const date = bytesToDate(dv([26, 4, 3, 10, 30, 0]));
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3); // 0-indexed
    expect(date.getDate()).toBe(3);
    expect(date.getHours()).toBe(10);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(0);
  });

  test("converts a 1990s date (year byte >= 90)", () => {
    // year=95 → 1995, month=12, day=31, hour=23, min=59, sec=59
    const date = bytesToDate(dv([95, 12, 31, 23, 59, 59]));
    expect(date.getFullYear()).toBe(1995);
    expect(date.getMonth()).toBe(11); // 0-indexed
    expect(date.getDate()).toBe(31);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });

  test("year boundary: 90 maps to 1990", () => {
    expect(bytesToDate(dv([90, 1, 1, 0, 0, 0])).getFullYear()).toBe(1990);
  });

  test("year boundary: 0 maps to 2000", () => {
    expect(bytesToDate(dv([0, 1, 1, 0, 0, 0])).getFullYear()).toBe(2000);
  });

  test("year boundary: 89 maps to 2089", () => {
    expect(bytesToDate(dv([89, 1, 1, 0, 0, 0])).getFullYear()).toBe(2089);
  });

  test("month is 1-indexed in protocol, 0-indexed in Date", () => {
    const date = bytesToDate(dv([26, 1, 1, 0, 0, 0]));
    expect(date.getMonth()).toBe(0); // January
  });

  test("throws for views not exactly 6 bytes", () => {
    expect(() => bytesToDate(dv([1, 2, 3, 4, 5]))).toThrow();
    expect(() => bytesToDate(dv([1, 2, 3, 4, 5, 6, 7]))).toThrow();
  });
});

describe("checkControlCode", () => {
  test("returns true when sum mod 256 equals control byte", () => {
    // sum = 1+2+3 = 6 → controlByte must be 6
    expect(checkControlCode(dv([1, 2, 3]), 6)).toBe(true);
  });

  test("returns false when sum does not match", () => {
    expect(checkControlCode(dv([1, 2, 3]), 7)).toBe(false);
  });

  test("wraps around 256 correctly", () => {
    // sum = 255 + 2 = 257 → 257 % 256 = 1
    expect(checkControlCode(dv([255, 2]), 1)).toBe(true);
  });

  test("defaults control byte to 0", () => {
    expect(checkControlCode(dv([128, 128]))).toBe(true); // 256 % 256 = 0
  });

  test("empty view always matches 0", () => {
    expect(checkControlCode(dv([]), 0)).toBe(true);
  });
});
