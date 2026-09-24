import { Mtr4TransformStream } from "../src";
import { singleSuccessMtr4, singleSuccessHistoryMtr4 } from "../src/mockdata";
import type { EcardMtr } from "../src";

async function readCard(data: Uint8Array): Promise<EcardMtr> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of data) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  const reader = source.pipeThrough(new Mtr4TransformStream()).getReader();
  return (await reader.read()).value as EcardMtr;
}

test("validates the card header in a recorded live reading", async () => {
  // Card 208560: 176 + 46 + 3 + week 27 + year 14 + checksum 246 = 512.
  expect((await readCard(singleSuccessMtr4)).validEcardHeadCheckByte).toBe(
    true,
  );
});

test("validates the preserved card header in a recorded MTR4 history reading", async () => {
  // This MTR4 capture retains week/year/checksum despite the older MTR documentation.
  expect(
    (await readCard(singleSuccessHistoryMtr4)).validEcardHeadCheckByte,
  ).toBe(true);
});

test("does not include reader timestamp or package number in the card checksum", async () => {
  const reading = singleSuccessMtr4.slice();
  reading[13] = (reading[13] + 1) % 60;
  reading[16] ^= 1;
  expect((await readCard(reading)).validEcardHeadCheckByte).toBe(true);
  expect((await readCard(reading)).validTransferCheckByte).toBe(false);
});

test("rejects corruption in each card header byte", async () => {
  for (let offset = 20; offset <= 25; offset++) {
    const reading = singleSuccessMtr4.slice();
    reading[offset] ^= 1;
    expect(
      (await readCard(reading)).validEcardHeadCheckByte,
      `offset ${offset}`,
    ).toBe(false);
  }
});
