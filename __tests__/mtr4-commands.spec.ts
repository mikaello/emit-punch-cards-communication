import { mtr4Commands } from "../src";

test("MTR4 clock command encodes the final two digits of the year", () => {
  const date = new Date(0);
  date.setFullYear(2101, 0, 2);
  date.setHours(3, 4, 5, 0);
  expect(mtr4Commands.getSetClockCommand(date)).toEqual(
    new Uint8Array([47, 83, 67, 1, 1, 2, 3, 4, 5]),
  );
});
