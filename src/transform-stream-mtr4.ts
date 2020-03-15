import { bytesToInt, checkControlCode, bytesToDate } from "./byteHandlingUtils";
import {
  getControlCodeInformation,
  checkForNewReadPosition,
  ringBufferReadLength,
  addToRingBuffer,
  getRangeFromRingBuffer,
  getMessageType,
} from "./transform-stream-utils";

export const serialOptionsMtr4 = {
  baudrate: 9600,
  stopbits: 1,
  parity: "none",
  databits: 8,
};

export enum BatterStatus {
  OK = 0,
  Low = 1,
}

export enum PackageType {
  StatusMessage = "S",
  EcardMtr = "M",
}

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

const ecardLength = 234;
const statusMessageLength = 59;

class Mtr4Unpacker {
  /** Will be used as a ringbuffer */
  data: Uint8Array;
  /** Current e-card og status message will start from this position */
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
    this.data = new Uint8Array(ecardLength * 3);
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
      ecardProductionYear: ecardData[23],
      ecardProductionWeek: ecardData[24],
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

  parseStatusMessage(statusMessage: Uint8Array) {
    // Status message
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
      uint8Array.byteLength,
      this.writePosition,
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

    if (currentReadLength === 59 && messageType === PackageType.StatusMessage) {
      console.log("we have a status message");
      this.parseStatusMessage(
        getRangeFromRingBuffer(this.data, this.readPosition, 59),
      );

      this.onChunk && this.onChunk(<MtrStatusMessage>{});
    } else if (
      currentReadLength === 234 &&
      messageType === PackageType.EcardMtr
    ) {
      const ecard = this.parseEcard(
        getRangeFromRingBuffer(this.data, this.readPosition, 234),
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
        unpacker.onChunk = chunk => controller.enqueue(chunk);
      },
      transform(uint8Array) {
        unpacker.addBinaryData(uint8Array);
      },
    });
  }
}
