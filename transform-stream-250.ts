import { bytesToInt, checkControlCode } from "./byteHandlingUtils.js"; // .js needed for browser

export type Ecard = {
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

const ecardLength = 217;

/**
 * This class unpacks Uint8Arrays and sends ecard objects when it gained enough data.
 *
 * Credits: https://github.com/mdn/dom-examples/blob/master/streams/png-transform-stream/png-transform-stream.js
 */
class EmitEKT250Unpacker {
  sendMetadataWhenRead: boolean;
  data: Uint8Array;
  unpackedQueue: Array<Ecard>;
  onChunk: null | ((chunk: Ecard) => void);
  position: null | number;
  previousWasStartByte: boolean;
  parsedEcardMetadata: boolean;

  /** @see `EmitEkt250TransformStream` for description of `sendMetadataWhenRead` */
  constructor(sendMetadataWhenRead: boolean) {
    this.sendMetadataWhenRead = sendMetadataWhenRead;
    this.data = new Uint8Array(ecardLength);
    this.unpackedQueue = [];
    this.onChunk = null;
    this.position = 0;
    this.previousWasStartByte = false;
    this.parsedEcardMetadata = false;
  }

  /**
   * Adds more binary data to unpack.
   *
   * @param {Uint8Array} uint8Array The data to add.
   */
  addBinaryData(uint8Array: Uint8Array) {
    let newPosition = this.position + uint8Array.length;
    if (newPosition >= ecardLength + 1) {
      // Crop of new reading, this will make that new reading corrupt, user will have to rescan card
      console.error("corrupt reading", uint8Array, this.position, newPosition);
      uint8Array = uint8Array.slice(
        0,
        uint8Array.length - (newPosition - ecardLength),
      );
    }

    for (let i = 0; i < uint8Array.length; i++) {
      if (Number(uint8Array[i]) === 0xff) {
        if (this.previousWasStartByte) {
          if (this.position !== 1 && !(this.position === 0 && i === 1)) {
            // Previous e-card was not fully read, new e-card reading started
            this.position = 1;
            this.data[0] = 0xff;
            uint8Array = uint8Array.slice(i);
            newPosition = uint8Array.byteLength + 1;
            this.parsedEcardMetadata = false;
            break;
          }
        } else {
          this.previousWasStartByte = true;
        }
      } else {
        this.previousWasStartByte = false;
      }
    }

    this.data.set(uint8Array, this.position);
    this.position = newPosition;

    this.checkForChunks();
  }

  getControlCodeInformation(view: DataView) {
    let codes: Array<{ code: number; time: number }> = [];
    for (let i = 0; i < view.byteLength; i += 3) {
      const code = view.getUint8(i);
      if (i > 0 && code === 0) {
        break;
      }

      const time = (view.getUint8(i + 2) << 8) | view.getUint8(i + 1);
      codes.push({ code, time });
    }

    if (codes.length > 0) {
      // The last stamped code will occur in duplicates (number of duplicates will
      // depend on how long the runner let his runner unit be on the EKT-device)
      // So removing duplicates of last control, since only the first punch matter
      const { code: finishCode } = codes[codes.length - 1];
      const indexOfFirstPunchOfLastControl = codes.findIndex(
        ({ code }) => code === finishCode,
      );
      codes = codes.filter(
        ({ code }, index) =>
          code !== finishCode || index === indexOfFirstPunchOfLastControl,
      );
    }

    return codes;
  }

  parseEcard(): Ecard {
    const checkByte = checkControlCode(new DataView(this.data.buffer, 2, 8));
    const ecardNumber = bytesToInt(new DataView(this.data.buffer, 2, 3));
    const ecardProductionWeek = this.data[6];
    const ecardProductionYear = this.data[7];
    const controlCodes = this.getControlCodeInformation(
      new DataView(this.data.buffer, 10, 150),
    );
    const decoder = new TextDecoder("ascii");
    const emitTimeSystemString = decoder.decode(
      new DataView(this.data.buffer, 160, 32),
    );
    const disp1 = decoder.decode(new DataView(this.data.buffer, 192, 8));
    const disp2 = decoder.decode(new DataView(this.data.buffer, 200, 8));
    const disp3 = decoder.decode(new DataView(this.data.buffer, 208, 8));

    return {
      ecardNumber,
      ecardProductionYear,
      ecardProductionWeek,
      validEcardCheckByte: checkByte,
      controlCodes,
      emitTimeSystemString,
      disp1,
      disp2,
      disp3,
      validTransferCheckByte: checkControlCode(new DataView(this.data.buffer)),
      finishedReading: true,
    };
  }

  parseEcardMetadata(): Ecard {
    const checkByte = checkControlCode(new DataView(this.data.buffer, 2, 8));
    const ecardNumber = bytesToInt(new DataView(this.data.buffer, 2, 3));
    const ecardProductionWeek = this.data[6];
    const ecardProductionYear = this.data[7];

    return {
      ecardNumber,
      ecardProductionYear,
      ecardProductionWeek,
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
    if (this.position === ecardLength) {
      const ecard = this.parseEcard();
      this.position = 0;
      this.parsedEcardMetadata = false;
      this.unpackedQueue.push(ecard);
    } else if (
      this.sendMetadataWhenRead &&
      !this.parsedEcardMetadata &&
      this.position >= 10
    ) {
      this.parsedEcardMetadata = true;
      const metadata = this.parseEcardMetadata();
      this.unpackedQueue.push(metadata);
    } else {
      return;
    }

    while (this.unpackedQueue.length > 0) {
      const ecard = this.unpackedQueue.pop();

      // Inform consumer about the found chunk
      if (typeof this.onChunk === "function" && ecard) {
        this.onChunk(ecard);
      }
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
  Ecard
> {
  /**
   * @param {boolean} sendMetadataWhenRead If true, objects containing only
   * ecard metadata will be sent as soon possible. With a duplicate sent right
   * after, containing same information plus control codes. Defaults to `true`.
   */
  constructor(sendMetadataWhenRead: boolean = true) {
    const unpacker = new EmitEKT250Unpacker(sendMetadataWhenRead);

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
