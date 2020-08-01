import { bytesToInt, checkControlCode, bytesToDate } from "./byteHandlingUtils";
import {
  getControlCodeInformation,
  checkForNewReadPosition,
  ringBufferReadLength,
  addToRingBuffer,
  getRangeFromRingBuffer,
  getMessageType,
  PackageType,
  BatterStatus,
} from "./transform-stream-utils";

export const serialOptionsMtr4 = {
  baudrate: 9600,
  stopbits: 1,
  parity: "none",
  databits: 8,
};

export type EcardMtr = {
  packageSize: number;
  packageType: PackageType.EcardMtr;
  mtrId: number;
  timestamp: Date;
  batteryStatus: BatterStatus;
  packageNumber: number;
  ecardNumber: number;
  ecardProductionWeek: number;
  ecardProductionYear: number;
  validEcardHeadCheckByte: boolean;
  controlCodes: Array<{ code: number; time: number }>;
  asciiString: string;
  validTransferCheckByte: boolean;
};

export type MtrStatusMessage = {
  packageSize: number;
  packageType: PackageType.StatusMessage;
  mtrId: number;
  currentTime: Date;
  batteryStatus: BatterStatus;
  recentPackage: number;
  oldestPackage: number;
  currentSessionStart: number;
  prev1SessionStart: number;
  prev2SessionStart: number;
  prev3SessionStart: number;
  prev4SessionStart: number;
  prev5SessionStart: number;
  prev6SessionStart: number;
  prev7SessionStart: number;
  validTransferCheckByte: boolean;
};

export type MtrTypes = EcardMtr | MtrStatusMessage;

/** Number of bytes that an ecard reading takes */
const ecardSize = 234;

/** Number of bytes that a status message takes */
const statusMessageSize = 59;

class Mtr4Unpacker {
  /** Ringbuffer */
  data: Uint8Array;
  /** Current e-card and status message will start from this position */
  readPosition: number;
  /** New data will be written to this position */
  writePosition: number;
  onChunk: null | ((chunk: MtrStatusMessage | EcardMtr) => void);

  consoleData: Uint8Array;
  timeout: any | null;

  constructor() {
    this.onChunk = null;
    this.consoleData = new Uint8Array(0);
    this.timeout = null;
    this.data = new Uint8Array(ecardSize * 3);
    this.readPosition = 0;
    this.writePosition = 0;
  }

  /**
   * @param uint8Array data to be appended to previous data, printed when data flow stops
   */
  printDataToConsole(uint8Array: Uint8Array) {
    const newData = new Uint8Array(this.consoleData.length + uint8Array.length);
    newData.set(this.consoleData, 0);
    newData.set(uint8Array, this.consoleData.length);
    this.consoleData = newData;

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.timeout = setTimeout(() => {
      console.log(
        "Number of bytes in this reading: " + this.consoleData.byteLength,
      );
      let allBytes = "";
      for (let byteIdx in this.consoleData) {
        allBytes += this.consoleData[byteIdx] + ",";
      }
      console.log(allBytes);

      this.consoleData = new Uint8Array();
    }, 5000);
  }

  parseEcard(ecardData: Uint8Array): EcardMtr {
    const decoder = new TextDecoder("ascii");
    const asciiString = decoder.decode(new DataView(ecardData.buffer, 176, 56));
    const packageType = decoder.decode(new DataView(ecardData.buffer, 5, 1));

    if (packageType !== PackageType.EcardMtr) {
      console.error("Wrong package type: " + packageType);
    }

    const batteryStatus =
      ecardData[16] === 0 ? BatterStatus.OK : BatterStatus.Low;

    return {
      packageSize: ecardData[4],
      packageType: PackageType.EcardMtr,
      mtrId: bytesToInt(new DataView(ecardData.buffer, 6, 2)),
      timestamp: bytesToDate(new DataView(ecardData.buffer, 8, 6)),
      batteryStatus,
      packageNumber: bytesToInt(new DataView(ecardData.buffer, 16, 4)),
      ecardNumber: bytesToInt(new DataView(ecardData.buffer, 20, 3)),
      ecardProductionWeek: ecardData[23],
      ecardProductionYear: ecardData[24],
      validEcardHeadCheckByte: checkControlCode(
        new DataView(ecardData.buffer, 4, 21),
        ecardData[25],
      ),
      controlCodes: getControlCodeInformation(
        new DataView(ecardData.buffer, 26, 150),
      ),
      asciiString,
      validTransferCheckByte: checkControlCode(
        new DataView(ecardData.buffer, 0, 232),
        ecardData[232],
      ),
    };
  }

  parseStatusMessage(statusMessage: Uint8Array): MtrStatusMessage {
    const decoder = new TextDecoder("ascii");
    const packageType = decoder.decode(
      new DataView(statusMessage.buffer, 5, 1),
    );

    if (packageType !== PackageType.StatusMessage) {
      console.error("Wrong package type: " + packageType);
    }

    const batteryStatus =
      statusMessage[16] === 0 ? BatterStatus.OK : BatterStatus.Low;

    return {
      packageSize: statusMessage[4],
      packageType: PackageType.StatusMessage,
      mtrId: bytesToInt(new DataView(statusMessage.buffer, 6, 2)),
      currentTime: bytesToDate(new DataView(statusMessage.buffer, 8, 6)),
      batteryStatus,
      recentPackage: bytesToInt(new DataView(statusMessage.buffer, 17, 4)),
      oldestPackage: bytesToInt(new DataView(statusMessage.buffer, 21, 4)),
      currentSessionStart: bytesToInt(
        new DataView(statusMessage.buffer, 25, 4),
      ),
      prev1SessionStart: bytesToInt(new DataView(statusMessage.buffer, 29, 4)),
      prev2SessionStart: bytesToInt(new DataView(statusMessage.buffer, 33, 4)),
      prev3SessionStart: bytesToInt(new DataView(statusMessage.buffer, 37, 4)),
      prev4SessionStart: bytesToInt(new DataView(statusMessage.buffer, 41, 4)),
      prev5SessionStart: bytesToInt(new DataView(statusMessage.buffer, 45, 4)),
      prev6SessionStart: bytesToInt(new DataView(statusMessage.buffer, 49, 4)),
      prev7SessionStart: bytesToInt(new DataView(statusMessage.buffer, 53, 4)),
      validTransferCheckByte: checkControlCode(
        new DataView(statusMessage.buffer, 0, 57),
        statusMessage[57],
      ),
    };
  }

  addBinaryData(uint8Array: Uint8Array) {
    //this.printDataToConsole(uint8Array);

    const newWritePosition = addToRingBuffer(
      this.data,
      uint8Array,
      this.writePosition,
    );

    const newReadPosition = checkForNewReadPosition(
      4,
      new DataView(this.data.buffer),
      this.writePosition,
      uint8Array.byteLength,
    );
    if (newReadPosition != null) {
      this.readPosition = newReadPosition;
    }

    this.writePosition = newWritePosition;

    this.checkForChunks();
  }

  checkForChunks() {
    const currentReadLength = ringBufferReadLength(
      this.data.byteLength,
      this.readPosition,
      this.writePosition,
    );
    const messageType =
      currentReadLength >= 6
        ? getMessageType(this.data, this.readPosition, 5)
        : null;

    if (
      currentReadLength === statusMessageSize &&
      messageType === PackageType.StatusMessage
    ) {
      const statusMessage = this.parseStatusMessage(
        getRangeFromRingBuffer(this.data, this.readPosition, statusMessageSize),
      );

      this.onChunk && this.onChunk(statusMessage);
    } else if (
      currentReadLength === ecardSize &&
      messageType === PackageType.EcardMtr
    ) {
      const ecard = this.parseEcard(
        getRangeFromRingBuffer(this.data, this.readPosition, ecardSize),
      );
      this.onChunk && this.onChunk(ecard);
    }
  }
}

export class Mtr4TransformStream extends TransformStream<
  Uint8Array,
  MtrStatusMessage | EcardMtr
> {
  constructor() {
    const unpacker = new Mtr4Unpacker();

    super({
      start(controller) {
        unpacker.onChunk = (chunk) => controller.enqueue(chunk);
      },
      transform(uint8Array) {
        unpacker.addBinaryData(uint8Array);
      },
    });
  }
}
