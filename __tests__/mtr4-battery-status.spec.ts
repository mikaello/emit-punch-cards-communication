import { Mtr4TransformStream, BatteryStatus, PackageType } from "../src";
import { singleSuccessMtr4, mtr4StatusMessage } from "../src/mockdata";

async function readMessage(data: Uint8Array) {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of data) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  return (
    await source.pipeThrough(new Mtr4TransformStream()).getReader().read()
  ).value!;
}

test("does not interpret a card message's package counter as a battery reading", async () => {
  const message = await readMessage(singleSuccessMtr4);
  expect(message.packageType).toBe(PackageType.EcardMtr);
  expect(message).not.toHaveProperty("batteryStatus");
});

test("a zero low byte in the package counter does not imply a healthy battery", async () => {
  const frame = singleSuccessMtr4.slice();
  frame[16] = 0;
  expect(await readMessage(frame)).not.toHaveProperty("batteryStatus");
});

test.each([BatteryStatus.OK, BatteryStatus.Low])(
  "reads battery status %i from a status message",
  async (status) => {
    const frame = mtr4StatusMessage.slice();
    frame[16] = status;
    const message = await readMessage(frame);
    expect(message.packageType).toBe(PackageType.StatusMessage);
    expect(message).toHaveProperty("batteryStatus", status);
  },
);
