import { bytesToInt, checkControlCode, bytesToDate } from "./byteHandlingUtils";
import {
  getControlCodeInformation,
  checkForNewReadPosition,
  ringBufferReadLength,
  addToRingBuffer,
  getRangeFromRingBuffer,
  getMessageType,
  PackageType,
  BatteryStatus,
} from "./transform-stream-utils";

export const serialOptionsMtr4 = {
  baudRate: 9600,
  stopBits: 1,
  parity: "none",
  dataBits: 8,
};

export type EcardMtr = {
  packageSize: number;
  packageType: PackageType.EcardMtr;
  mtrId: number;
  timestamp: Date;
  batteryStatus: BatteryStatus;
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
  batteryStatus: BatteryStatus;
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

// Byte offsets shared by both ecard and status message frames
const OFF_MTR_PREAMBLE_LENGTH = 4; // four 0xFF bytes start each frame
const OFF_MTR_PACKAGE_SIZE = 4; // byte 5: package size
const OFF_MTR_PACKAGE_TYPE = 5; // byte 6: package type ('M' or 'S')
const OFF_MTR_MTR_ID = 6; // bytes 7-8: MTR unit ID (2 bytes)
const LEN_MTR_MTR_ID = 2;
const OFF_MTR_TIMESTAMP = 8; // bytes 9-14: timestamp (6 bytes)
const LEN_MTR_TIMESTAMP = 6;
const OFF_MTR_BATTERY_STATUS = 16; // byte 17: battery status

// Ecard-specific offsets
const OFF_MTR_ECARD_PACKAGE_NUMBER = 16; // bytes 17-20: package number (4 bytes)
const LEN_MTR_ECARD_PACKAGE_NUMBER = 4;
const OFF_MTR_ECARD_NUMBER = 20; // bytes 21-23: ecard number (3 bytes)
const LEN_MTR_ECARD_NUMBER = 3;
const OFF_MTR_ECARD_PRODUCTION_WEEK = 23; // byte 24
const OFF_MTR_ECARD_PRODUCTION_YEAR = 24; // byte 25
const OFF_MTR_ECARD_HEAD_CHECK_START = 4; // bytes 5-25: ecard head checksum region
const LEN_MTR_ECARD_HEAD_CHECK = 21;
const OFF_MTR_ECARD_HEAD_CHECK_BYTE = 25; // byte 26: expected head checksum
const OFF_MTR_ECARD_CONTROL_CODES = 26; // bytes 27-176: 50 × (code + 2-byte time)
const LEN_MTR_ECARD_CONTROL_CODES = 150;
const OFF_MTR_ECARD_ASCII_STRING = 176; // bytes 177-232: ASCII string
const LEN_MTR_ECARD_ASCII_STRING = 56;
const OFF_MTR_ECARD_TRANSFER_CHECK_REGION = 0; // bytes 1-232
const LEN_MTR_ECARD_TRANSFER_CHECK_REGION = 232;
const OFF_MTR_ECARD_TRANSFER_CHECK_BYTE = 232; // byte 233

// Status message-specific offsets
const OFF_MTR_STATUS_RECENT_PACKAGE = 17; // bytes 18-21 (4 bytes)
const LEN_MTR_STATUS_PACKAGE_NUMBER = 4;
const OFF_MTR_STATUS_OLDEST_PACKAGE = 21; // bytes 22-25
const OFF_MTR_STATUS_SESSION_START_CURRENT = 25; // bytes 26-29
const OFF_MTR_STATUS_SESSION_START_PREV1 = 29; // bytes 30-33
const OFF_MTR_STATUS_SESSION_START_PREV2 = 33;
const OFF_MTR_STATUS_SESSION_START_PREV3 = 37;
const OFF_MTR_STATUS_SESSION_START_PREV4 = 41;
const OFF_MTR_STATUS_SESSION_START_PREV5 = 45;
const OFF_MTR_STATUS_SESSION_START_PREV6 = 49;
const OFF_MTR_STATUS_SESSION_START_PREV7 = 53;
const OFF_MTR_STATUS_TRANSFER_CHECK_REGION = 0; // bytes 1-57
const LEN_MTR_STATUS_TRANSFER_CHECK_REGION = 57;
const OFF_MTR_STATUS_TRANSFER_CHECK_BYTE = 57; // byte 58
const OFF_MTR_TYPE_DETECT_MIN_LENGTH = 6; // need at least 6 bytes to read type byte

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
    const asciiString = decoder.decode(
      new DataView(
        ecardData.buffer,
        OFF_MTR_ECARD_ASCII_STRING,
        LEN_MTR_ECARD_ASCII_STRING,
      ),
    );
    const packageType = decoder.decode(
      new DataView(ecardData.buffer, OFF_MTR_PACKAGE_TYPE, 1),
    );

    if (packageType !== PackageType.EcardMtr) {
      console.error("Wrong package type: " + packageType);
    }

    const batteryStatus =
      ecardData[OFF_MTR_BATTERY_STATUS] === 0
        ? BatteryStatus.OK
        : BatteryStatus.Low;

    return {
      packageSize: ecardData[OFF_MTR_PACKAGE_SIZE],
      packageType: PackageType.EcardMtr,
      mtrId: bytesToInt(
        new DataView(ecardData.buffer, OFF_MTR_MTR_ID, LEN_MTR_MTR_ID),
      ),
      timestamp: bytesToDate(
        new DataView(ecardData.buffer, OFF_MTR_TIMESTAMP, LEN_MTR_TIMESTAMP),
      ),
      batteryStatus,
      packageNumber: bytesToInt(
        new DataView(
          ecardData.buffer,
          OFF_MTR_ECARD_PACKAGE_NUMBER,
          LEN_MTR_ECARD_PACKAGE_NUMBER,
        ),
      ),
      ecardNumber: bytesToInt(
        new DataView(
          ecardData.buffer,
          OFF_MTR_ECARD_NUMBER,
          LEN_MTR_ECARD_NUMBER,
        ),
      ),
      ecardProductionWeek: ecardData[OFF_MTR_ECARD_PRODUCTION_WEEK],
      ecardProductionYear: ecardData[OFF_MTR_ECARD_PRODUCTION_YEAR],
      validEcardHeadCheckByte: checkControlCode(
        new DataView(
          ecardData.buffer,
          OFF_MTR_ECARD_HEAD_CHECK_START,
          LEN_MTR_ECARD_HEAD_CHECK,
        ),
        ecardData[OFF_MTR_ECARD_HEAD_CHECK_BYTE],
      ),
      controlCodes: getControlCodeInformation(
        new DataView(
          ecardData.buffer,
          OFF_MTR_ECARD_CONTROL_CODES,
          LEN_MTR_ECARD_CONTROL_CODES,
        ),
      ),
      asciiString,
      validTransferCheckByte: checkControlCode(
        new DataView(
          ecardData.buffer,
          OFF_MTR_ECARD_TRANSFER_CHECK_REGION,
          LEN_MTR_ECARD_TRANSFER_CHECK_REGION,
        ),
        ecardData[OFF_MTR_ECARD_TRANSFER_CHECK_BYTE],
      ),
    };
  }

  parseStatusMessage(statusMessage: Uint8Array): MtrStatusMessage {
    const decoder = new TextDecoder("ascii");
    const packageType = decoder.decode(
      new DataView(statusMessage.buffer, OFF_MTR_PACKAGE_TYPE, 1),
    );

    if (packageType !== PackageType.StatusMessage) {
      console.error("Wrong package type: " + packageType);
    }

    const batteryStatus =
      statusMessage[OFF_MTR_BATTERY_STATUS] === 0
        ? BatteryStatus.OK
        : BatteryStatus.Low;

    return {
      packageSize: statusMessage[OFF_MTR_PACKAGE_SIZE],
      packageType: PackageType.StatusMessage,
      mtrId: bytesToInt(
        new DataView(statusMessage.buffer, OFF_MTR_MTR_ID, LEN_MTR_MTR_ID),
      ),
      currentTime: bytesToDate(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_TIMESTAMP,
          LEN_MTR_TIMESTAMP,
        ),
      ),
      batteryStatus,
      recentPackage: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_RECENT_PACKAGE,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      oldestPackage: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_OLDEST_PACKAGE,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      currentSessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_CURRENT,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev1SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV1,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev2SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV2,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev3SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV3,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev4SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV4,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev5SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV5,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev6SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV6,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      prev7SessionStart: bytesToInt(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_SESSION_START_PREV7,
          LEN_MTR_STATUS_PACKAGE_NUMBER,
        ),
      ),
      validTransferCheckByte: checkControlCode(
        new DataView(
          statusMessage.buffer,
          OFF_MTR_STATUS_TRANSFER_CHECK_REGION,
          LEN_MTR_STATUS_TRANSFER_CHECK_REGION,
        ),
        statusMessage[OFF_MTR_STATUS_TRANSFER_CHECK_BYTE],
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
      OFF_MTR_PREAMBLE_LENGTH,
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
      currentReadLength >= OFF_MTR_TYPE_DETECT_MIN_LENGTH
        ? getMessageType(this.data, this.readPosition, OFF_MTR_PACKAGE_TYPE)
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
