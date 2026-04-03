import { bytesToInt, checkControlCode } from "./byteHandlingUtils";
import {
  getControlCodeInformation,
  addToRingBuffer,
  checkForNewReadPosition,
  ringBufferReadLength,
  getRangeFromRingBuffer,
} from "./transform-stream-utils";

export type Ecard250 = {
  ecardNumber: number;
  ecardProductionWeek: number;
  ecardProductionYear: number;
  validEcardCheckByte: boolean;
  controlCodes: Array<{ code: number; time: number }>;
  emitTimeSystemString?: string;
  disp1?: string;
  disp2?: string;
  disp3?: string;
  validTransferCheckByte: boolean;
  finishedReading: boolean;
};

export const serialOptions250 = {
  baudRate: 9600,
  stopBits: 2,
  parity: "none",
  dataBits: 8,
};

const ecardLength = 217;

// Byte offsets within a 250 ecard message (after XOR decoding, 1-indexed in spec)
const OFF_250_ECARD_NUMBER = 2; // bytes 3-5: ecard number (3 bytes, LSB)
const LEN_250_ECARD_NUMBER = 3;
const OFF_250_PRODUCTION_WEEK = 6; // byte 7
const OFF_250_PRODUCTION_YEAR = 7; // byte 8
const OFF_250_HEAD_CHECK_START = 2; // bytes 3-10: ecard head checksum region
const LEN_250_HEAD_CHECK = 8;
const OFF_250_CONTROL_CODES = 10; // bytes 11-160: 50 × (code + 2-byte time)
const LEN_250_CONTROL_CODES = 150;
const OFF_250_EMIT_TIME_STRING = 160; // bytes 161-192: ASCII emit time system string
const LEN_250_EMIT_TIME_STRING = 32;
const OFF_250_DISP1 = 192; // bytes 193-200: display string 1
const LEN_250_DISP = 8;
const OFF_250_DISP2 = 200; // bytes 201-208: display string 2
const OFF_250_DISP3 = 208; // bytes 209-216: display string 3
const LEN_250_METADATA = 10; // bytes needed for metadata-only parse (up to head check)
const LEN_250_PREAMBLE = 2; // two 0xFF bytes start each frame

/**
 * This class unpacks Uint8Arrays and sends ecard objects when it gained enough data.
 *
 * Credits: https://github.com/mdn/dom-examples/blob/master/streams/png-transform-stream/png-transform-stream.js
 */
class EmitEKT250Unpacker {
  /** Ringbuffer */
  data: Uint8Array;
  /** Current e-card and status message will start from this position */
  readPosition: number;
  /** New data will be written to this position */
  writePosition: number;

  /** Option to send metadata as soon as it is read */
  sendMetadataWhenRead: boolean;
  parsedEcardMetadata: boolean;

  unpackedQueue: Array<Ecard250>;
  onChunk: null | ((chunk: Ecard250) => void);

  /** @see `EmitEkt250TransformStream` for description of `sendMetadataWhenRead` */
  constructor(sendMetadataWhenRead: boolean) {
    this.sendMetadataWhenRead = sendMetadataWhenRead;
    this.data = new Uint8Array(ecardLength * 3);
    this.readPosition = 0;
    this.writePosition = 0;
    this.unpackedQueue = [];
    this.onChunk = null;
    this.parsedEcardMetadata = false;
  }

  /**
   * Adds more binary data to unpack.
   *
   * @param {Uint8Array} uint8Array The data to add.
   */
  addBinaryData(uint8Array: Uint8Array) {
    const newWritePosition = addToRingBuffer(
      this.data,
      uint8Array,
      this.writePosition,
    );

    const newReadPosition = checkForNewReadPosition(
      LEN_250_PREAMBLE,
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

  parseEcard(ecardData: Uint8Array): Ecard250 {
    const decoder = new TextDecoder("ascii");
    const emitTimeSystemString = decoder.decode(
      new DataView(
        ecardData.buffer,
        OFF_250_EMIT_TIME_STRING,
        LEN_250_EMIT_TIME_STRING,
      ),
    );
    const disp1 = decoder.decode(
      new DataView(ecardData.buffer, OFF_250_DISP1, LEN_250_DISP),
    );
    const disp2 = decoder.decode(
      new DataView(ecardData.buffer, OFF_250_DISP2, LEN_250_DISP),
    );
    const disp3 = decoder.decode(
      new DataView(ecardData.buffer, OFF_250_DISP3, LEN_250_DISP),
    );

    return {
      ecardNumber: bytesToInt(
        new DataView(
          ecardData.buffer,
          OFF_250_ECARD_NUMBER,
          LEN_250_ECARD_NUMBER,
        ),
      ),
      ecardProductionWeek: ecardData[OFF_250_PRODUCTION_WEEK],
      ecardProductionYear: ecardData[OFF_250_PRODUCTION_YEAR],
      validEcardCheckByte: checkControlCode(
        new DataView(
          ecardData.buffer,
          OFF_250_HEAD_CHECK_START,
          LEN_250_HEAD_CHECK,
        ),
        0,
      ),
      controlCodes: getControlCodeInformation(
        new DataView(
          ecardData.buffer,
          OFF_250_CONTROL_CODES,
          LEN_250_CONTROL_CODES,
        ),
      ),
      emitTimeSystemString,
      disp1,
      disp2,
      disp3,
      validTransferCheckByte: checkControlCode(
        new DataView(ecardData.buffer),
        0,
      ),
      finishedReading: true,
    };
  }

  parseEcardMetadata(metadata: Uint8Array): Ecard250 {
    const checkByte = checkControlCode(
      new DataView(
        metadata.buffer,
        OFF_250_HEAD_CHECK_START,
        LEN_250_HEAD_CHECK,
      ),
      0,
    );

    return {
      ecardNumber: bytesToInt(
        new DataView(
          metadata.buffer,
          OFF_250_ECARD_NUMBER,
          LEN_250_ECARD_NUMBER,
        ),
      ),
      ecardProductionWeek: metadata[OFF_250_PRODUCTION_WEEK],
      ecardProductionYear: metadata[OFF_250_PRODUCTION_YEAR],
      validEcardCheckByte: checkByte,
      controlCodes: [],
      validTransferCheckByte: false,
      finishedReading: false,
    };
  }

  /**
   * Checks whether new chunks can be found within the binary data.
   */
  checkForChunks() {
    const currentReadLength = ringBufferReadLength(
      this.data.byteLength,
      this.readPosition,
      this.writePosition,
    );

    if (currentReadLength === ecardLength) {
      const ecard = this.parseEcard(
        getRangeFromRingBuffer(this.data, this.readPosition, ecardLength),
      );
      this.parsedEcardMetadata = false;
      this.onChunk && this.onChunk(ecard);
    } else if (
      this.sendMetadataWhenRead &&
      !this.parsedEcardMetadata &&
      currentReadLength >= LEN_250_METADATA
    ) {
      this.parsedEcardMetadata = true;
      const metadata = this.parseEcardMetadata(
        getRangeFromRingBuffer(this.data, this.readPosition, LEN_250_METADATA),
      );
      this.onChunk && this.onChunk(metadata);
    }
  }
}

/**
 * This transform stream unpacks objects of e-card info from an EMIT EKT 250 device.
 *
 * It can be consumed by a ReadableStream's pipeThrough method.
 */
export class EmitEkt250TransformStream extends TransformStream<
  Uint8Array,
  Ecard250
> {
  /**
   * @param {boolean} sendMetadataWhenRead If true, objects containing only
   * ecard metadata will be sent as soon possible. With a duplicate sent right
   * after, containing same information plus control codes. Defaults to `false`.
   */
  constructor(sendMetadataWhenRead: boolean = false) {
    const unpacker = new EmitEKT250Unpacker(sendMetadataWhenRead);

    super({
      start(controller) {
        unpacker.onChunk = (chunk) => controller.enqueue(chunk);
      },
      transform(uint8Array) {
        const od = 255 - 32; // necessary to XOR with this, see OdTransformStream
        unpacker.addBinaryData(uint8Array.map((byte) => byte ^ od));
      },
    });
  }
}

/**
 * This transform stream XOR-s all bytes with OD (255-32), which is required by the spec.
 *
 * It can be consumed by a ReadableStream's pipeThrough method.
 */
export class OdTransformStream extends TransformStream<Uint8Array> {
  constructor() {
    const od = 255 - 32;
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk.map((byte) => byte ^ od));
      },
    });
  }
}
