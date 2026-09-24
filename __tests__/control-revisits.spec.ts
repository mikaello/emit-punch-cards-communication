import { getControlCodeInformation } from "../src/transform-stream-utils";

const read = (punches: Array<[number, number]>) => {
  const data = new Uint8Array(150);
  punches.forEach(([code, time], i) => {
    data[i * 3] = code;
    data[i * 3 + 1] = time & 0xff;
    data[i * 3 + 2] = time >>> 8;
  });
  return getControlCodeInformation(new DataView(data.buffer));
};

test("retains a later visit to the final control after another control", () => {
  expect(
    read([
      [0, 0],
      [31, 100],
      [32, 200],
      [31, 300],
    ]),
  ).toEqual([
    { code: 0, time: 0 },
    { code: 31, time: 100 },
    { code: 32, time: 200 },
    { code: 31, time: 300 },
  ]);
});

test("collapses only the terminal run of repeated finish punches", () => {
  expect(
    read([
      [0, 0],
      [31, 100],
      [32, 200],
      [31, 300],
      [31, 301],
      [31, 302],
    ]),
  ).toEqual([
    { code: 0, time: 0 },
    { code: 31, time: 100 },
    { code: 32, time: 200 },
    { code: 31, time: 300 },
  ]);
});

test("leaves repeated intermediate controls intact", () => {
  expect(
    read([
      [0, 0],
      [31, 100],
      [31, 101],
      [32, 200],
      [32, 201],
    ]),
  ).toEqual([
    { code: 0, time: 0 },
    { code: 31, time: 100 },
    { code: 31, time: 101 },
    { code: 32, time: 200 },
  ]);
});

test("handles an empty view and a single punch", () => {
  expect(getControlCodeInformation(new DataView(new ArrayBuffer(0)))).toEqual(
    [],
  );
  expect(read([[0, 0]])).toEqual([{ code: 0, time: 0 }]);
});
