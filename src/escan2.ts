/** eScan2 USB serial settings (115200 8N1, no flow control). */
export const serialOptionsEscan2 = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
} as const;

export type Escan2Status = {
  kind: "status";
  productName: "eScan2";
  hardwareVersion: string;
  softwareVersion: string;
  version: string;
  totalMessages: number;
  messagesToday: number;
  date: string;
  time: string;
  controlCode: number;
  protocol: number;
  serialNumber: string;
  batteryMillivolts: number;
  usbMillivolts: number;
  batteryPercent: number;
  checksum: number;
  validChecksum: boolean;
};

export type Escan2Punch = {
  number: number;
  code: number;
  /** Clock time for protocols 0 and 1, milliseconds since production otherwise. */
  time: string | number;
  extra: string[];
};

export type Escan2Dump = {
  kind: "dump";
  tagType: "eCard" | "emiTag";
  cardNumber: number;
  tagNumber: number;
  date: string;
  time: string;
  protocol: number;
  power: string;
  description: string;
  punches: Escan2Punch[];
  checksum: number;
  validChecksum: boolean;
};

export type Escan2Passing = {
  kind: "passing";
  cardNumber: number;
  controlCode: number;
  time: string;
  serialNumber?: string;
  messageNumber?: number;
  elapsed?: string;
  transmissions?: number;
  checksum: number;
  validChecksum: boolean;
};

export type Escan2Frame = Escan2Status | Escan2Dump | Escan2Passing;

const ascii = new TextDecoder("ascii");
const datePattern = /^\d{2}\.\d{2}\.\d{4}$/;
const timePattern = /^\d{2}:\d{2}:\d{2}\.\d{3}$/;

/** Returns null for incomplete or unknown eScan2 frames. */
export function parseEscan2Frame(bytes: Uint8Array): Escan2Frame | null {
  const raw = ascii.decode(bytes).trim();
  const checksumMatch = /(?:^|\s)R([0-9a-fA-F]{2})$/.exec(raw);
  if (!checksumMatch) return null;
  const checksum = Number.parseInt(checksumMatch[1], 16);
  // Published status and passing examples sum non-whitespace ASCII bytes mod 256.
  const payload = raw.slice(0, checksumMatch.index).trimEnd();
  let sum = 0;
  for (const byte of bytes.subarray(0, bytes.lastIndexOf(0x52))) {
    if (byte !== 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      sum += byte;
    }
  }
  const validChecksum = sum % 256 === checksum;
  const fields = new Map<string, string>();
  for (const token of payload.split(/\s+/)) {
    if (payload.startsWith("N") && token.startsWith("D")) break;
    if (/^[A-Z].+/.test(token)) fields.set(token[0], token.slice(1));
  }
  const integer = (key: string) => {
    const value = fields.get(key);
    return value && /^\d+$/.test(value) ? Number(value) : null;
  };
  const date = fields.get("U");
  const time = fields.get("W");

  if (payload.startsWith("IESCAN2-")) {
    const identity = /^IESCAN2-HW([^\s-]+)-SW([^\s-]+)-V([^\s]+)$/.exec(
      payload.split(/\s/)[0],
    );
    const counters = /^(\d+)-(\d+)$/.exec(fields.get("M") ?? "");
    const power = /^(\d+)-(\d+)(?:-[+-]\d+)?-(\d+)$/.exec(
      fields.get("A") ?? "",
    );
    const controlCode = integer("C");
    const protocol = integer("X");
    if (
      !identity ||
      fields.get("B") !== "S" ||
      !counters ||
      !power ||
      !date ||
      !datePattern.test(date) ||
      !time ||
      !timePattern.test(time) ||
      controlCode === null ||
      protocol === null ||
      protocol > 7 ||
      !/^\d+$/.test(fields.get("Y") ?? "")
    )
      return null;
    return {
      kind: "status",
      productName: "eScan2",
      hardwareVersion: identity[1],
      softwareVersion: identity[2],
      version: identity[3],
      totalMessages: Number(counters[1]),
      messagesToday: Number(counters[2]),
      date,
      time,
      controlCode,
      protocol,
      serialNumber: fields.get("Y")!,
      batteryMillivolts: Number(power[1]) * 100,
      usbMillivolts: Number(power[2]) * 100,
      batteryPercent: Number(power[3]),
      checksum,
      validChecksum,
    };
  }

  if (/^BM(?:\s|$)/.test(payload)) {
    const cardNumber = integer("N");
    const controlCode = integer("C");
    const passingTime = fields.get("E");
    if (
      cardNumber === null ||
      controlCode === null ||
      !passingTime ||
      !timePattern.test(passingTime)
    )
      return null;
    return {
      kind: "passing",
      cardNumber,
      controlCode,
      time: passingTime,
      serialNumber: fields.get("Y"),
      messageNumber: integer("M") ?? undefined,
      elapsed: fields.get("T"),
      transmissions: integer("O") ?? undefined,
      checksum,
      validChecksum,
    };
  }

  if (payload.startsWith("N")) {
    const cardNumber = integer("N");
    const tagNumber = integer("S");
    const protocol = integer("X");
    const power = fields.get("V");
    // W may be followed immediately by the tag number in the documented format.
    const dumpTime = time?.slice(0, 12);
    if (
      cardNumber === null ||
      tagNumber === null ||
      protocol === null ||
      protocol > 7 ||
      !date ||
      !datePattern.test(date) ||
      !dumpTime ||
      !timePattern.test(dumpTime) ||
      !power
    )
      return null;
    const punches: Escan2Punch[] = [];
    for (const match of payload.matchAll(/(?:^|\s)[PQ](\d+)-(\d+)-([^\s]+)/g)) {
      const segments = match[3].split("-");
      const punchTime = protocol < 2 ? segments[0] : Number(segments[0]);
      if (typeof punchTime === "number" && !Number.isFinite(punchTime))
        return null;
      punches.push({
        number: Number(match[1]),
        code: Number(match[2]),
        time: punchTime,
        extra: segments.slice(1),
      });
    }
    const description =
      /(?:^|\s)D(.+?)(?=\s+[PQ]\d+-|$)/.exec(payload)?.[1] ?? "";
    return {
      kind: "dump",
      tagType: fields.has("L") ? "emiTag" : "eCard",
      cardNumber,
      tagNumber,
      date,
      time: dumpTime,
      protocol,
      power,
      description,
      punches,
      checksum,
      validChecksum,
    };
  }
  return null;
}
