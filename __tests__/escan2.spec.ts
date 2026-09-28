import {
  EmitEscan2TransformStream,
  escan2Commands,
  serialOptionsEscan2,
  type Escan2Frame,
} from "../src";

// Synthetic frames based on the published eScan2 protocol, not hardware captures.
const framed = (payload: string) => {
  const checksum =
    [...new TextEncoder().encode(payload.replace(/\s/g, ""))].reduce(
      (sum, byte) => sum + byte,
      0,
    ) % 256;
  return new TextEncoder().encode(
    `\x02${payload} R${checksum.toString(16).padStart(2, "0").toUpperCase()}\x03\r\n`,
  );
};
const status =
  "IESCAN2-HW1-SW1-V1.02 BS M12-3 U21.01.2021 W09:40:14.274 C250 X0 Y123 A30-49-+0-100";
const dump =
  "N240919 U21.01.2021 W09:48:40.000240919 X0 V000-000-318 S240919 DEmit EPT V5.00 P0-0-00:00:00.000 P1-250-00:01:43.000";
const tag =
  "N3845575 U21.01.2021 W09:44:57.0003845575 L0112 X0 V306-255255 S3845575 DemiTag II P0-240-81:08:34.660";
const passing = "BM N3845575 Y0 M108 C65 E09:59:27.965 T04:23:00.069 O0";

async function collect(chunks: Uint8Array[]): Promise<Escan2Frame[]> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const frames: Escan2Frame[] = [];
  for await (const frame of source.pipeThrough(
    new EmitEscan2TransformStream(),
  )) {
    frames.push(frame);
  }
  return frames;
}

test("uses the eScan2 serial settings", () => {
  expect(serialOptionsEscan2).toEqual({
    baudRate: 115200,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none",
  });
});

test("decodes status and checks counters and checksum", async () => {
  expect(await collect([framed(status)])).toMatchObject([
    {
      kind: "status",
      productName: "eScan2",
      totalMessages: 12,
      messagesToday: 3,
      serialNumber: "123",
      batteryMillivolts: 3000,
      usbMillivolts: 4900,
      validChecksum: true,
    },
  ]);
  const broken = framed(status).slice();
  broken[status.indexOf("C250") + 2] = "9".charCodeAt(0);
  expect(await collect([broken])).toMatchObject([{ validChecksum: false }]);
});

test("matches published status and passing checksum examples", async () => {
  const examples = [
    "IESCAN2-HW1-SW1-V1.02 BS M1-1 U21.01.2021 W09:40:14.274 C250 X0 Y0 A30-49-100 R88",
    "BM N3845575 C65 E10:00:10.277 RA9",
    "BM N3845575 Y0 M108 C65 E09:59:27.965 T04:23:00.069 O0 R77",
  ];
  const frames = await collect(
    examples.map((example) => new TextEncoder().encode(`\x02${example}\x03`)),
  );
  expect(frames).toHaveLength(3);
  expect(frames.every((frame) => frame.validChecksum)).toBe(true);
  expect(await collect([framed(passing.replaceAll(" ", "\t"))])).toMatchObject([
    { kind: "passing", validChecksum: true },
  ]);
});

test("reassembles split and coalesced status, dump, and passing frames", async () => {
  const all = new Uint8Array([
    ...framed(status),
    ...framed(dump),
    ...framed(tag),
    ...framed(passing),
  ]);
  const expected = await collect([all]);
  expect(expected).toMatchObject([
    { kind: "status" },
    {
      kind: "dump",
      tagType: "eCard",
      cardNumber: 240919,
      punches: [{ code: 0 }, { code: 250 }],
    },
    {
      kind: "dump",
      tagType: "emiTag",
      cardNumber: 3845575,
      punches: [{ code: 240 }],
    },
    {
      kind: "passing",
      cardNumber: 3845575,
      messageNumber: 108,
      controlCode: 65,
      elapsed: "04:23:00.069",
    },
  ]);
  for (let offset = 0; offset <= all.length; offset++) {
    expect(await collect([all.slice(0, offset), all.slice(offset)])).toEqual(
      expected,
    );
  }
});

test("keeps extended protocol punch data", async () => {
  const extended =
    "N3845575 U21.01.2021 W09:44:57.0003845575 L0112 X7 V306-255255 S3845575 DemiTag II Q0-250-37493599036-168:53:19.036-07:48:43.890-2";
  expect(await collect([framed(extended)])).toMatchObject([
    {
      kind: "dump",
      protocol: 7,
      punches: [
        {
          number: 0,
          code: 250,
          time: 37493599036,
          extra: ["168:53:19.036", "07:48:43.890", "2"],
        },
      ],
    },
  ]);
});

test("ignores malformed frames and resumes at the next STX", async () => {
  const bytes = new Uint8Array([
    ...new TextEncoder().encode("\x02Iunfinished"),
    ...framed("IESCAN2-HW1-SW1-V1.02 BS Mbad"),
    ...framed(status),
  ]);
  expect(await collect([bytes])).toMatchObject([{ kind: "status" }]);
});

test("encodes read-only commands and validates spool indices", () => {
  const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  expect(decode(escan2Commands.getStatusCommand())).toBe("/ST\r\n");
  expect(decode(escan2Commands.getTodayCommand())).toBe("/QM\r\n");
  expect(decode(escan2Commands.getAllCommand())).toBe("/QD\r\n");
  expect(decode(escan2Commands.getMessageCommand(4))).toBe("/QC4\r\n");
  expect(decode(escan2Commands.getMessagesFromCommand(4))).toBe("/QF4\r\n");
  expect(decode(escan2Commands.getTagCommand(3845575))).toBe("/QT3845575\r\n");
  expect(decode(escan2Commands.getStopCommand())).toBe("/QS\r\n");
  expect(() => escan2Commands.getMessageCommand(0)).toThrow(RangeError);
});
