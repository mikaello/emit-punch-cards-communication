import {
  addToRingBuffer,
  ringBufferReadLength,
  getRangeFromRingBuffer,
  getByteIndexInNewRingbufferData,
  USB_START_READ_BYTE,
  USB_STOP_READ_BYTE,
} from "./transform-stream-utils";

export type UsbFrame = {
  productName: "eScan" | "ECU";
  hardwareVersion: string;
  softwareVersion: string;
  version: string;
  eScanMessageType?: "S"; // eScan only
  elineCode: string; // from 0 to 255 (254 on ECU)
  tagProtocol: "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
  serialNumber: string;
  eScanBatteryVoltageMillivolt?: string; // eScan only
  eScanUsbVoltageMillivolt?: string; // eScan only
  eScanBatteryPercentage?: string; // eScan only
  eScanISODate: string; // eScan only, ISO date
  timeMilliseconds: string; // milliseconds since EPOCH
  statusMessageAndEvent: string; // eScan only
  ecuFirstMessageNumberToday: number; // ECU only
  ecuTotalMessagesToday: number; // ECU only
};

// TODO: fill this with properties
export type DumpTagFrame = {};

/**
 * This class unpacks Uint8Arrays and sends frames and time objects when gained enough data.
 *
 * Credits: https://github.com/mdn/dom-examples/blob/master/streams/png-transform-stream/png-transform-stream.js
 */
export class EmitEscanUnpacker {
  /** Ringbuffer */
  data: Uint8Array;
  /** Current reading position */
  readPosition: number;
  /** New data will be written to this position */
  writePosition: number;

  /** Everytime a new frame is compiled, this function will get it */
  onChunk: null | ((chunk: UsbFrame | DumpTagFrame) => void);

  constructor() {
    this.data = new Uint8Array(4000);
    this.readPosition = 0;
    this.writePosition = 0;
    this.onChunk = null;
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

    const newReadPosition = getByteIndexInNewRingbufferData(
      this.data.byteLength,
      this.writePosition,
      uint8Array,
      USB_START_READ_BYTE,
    );

    if (newReadPosition != null) {
      this.readPosition = newReadPosition;
    }

    if (this.readPosition) {
      const completeReadingPosition = getByteIndexInNewRingbufferData(
        this.data.byteLength,
        this.writePosition,
        uint8Array,
        USB_STOP_READ_BYTE,
      );

      completeReadingPosition && this.checkForChunks(completeReadingPosition);
    }

    this.writePosition = newWritePosition;
  }

  parseFrame(frameData: Uint8Array): UsbFrame {
    const decoder = new TextDecoder("ascii");
    const frameText = decoder.decode(frameData.buffer);

    const iMatch =
      /I(?<productName>\w+?)-HW(?<hwVersion>.+?)-SW(?<swVersion>.+?)-V(?<version>.+?)\s/gm.exec(
        frameText,
      );
    const bMatch = /\tB(?<messageType>\w{1})\t/gm.exec(frameText);
    const cMatch = /\tC(?<elineCode>[0-9]{1,3})\t/gm.exec(frameText);
    const xMatch = /\tX(?<protocol>[0-9])\t/gm.exec(frameText);
    const yMatch = /\tY(?<serialNum>[0-9]+)\t/gm.exec(frameText);
    // const aMatch = // TODO: battery parsing
    const uMatch = /\tU(?<date>[0-9]{2}[.][0-9]{2}[.][0-9]{4})\t/gm.exec(
      frameText,
    );
    const wMatch =
      /\tW(?<time>[0-9]{2}[:][0-9]{2}[:][0-9]{2}[.][0-9]{3})/gm.exec(frameText);

    const i = iMatch?.groups;
    return {
      // @ts-ignore
      productName: i?.productName ?? "unknown",
      hardwareVersion: i?.hwVersion ?? "unknown",
      softwareVersion: i?.swVersion ?? "unknown",
      version: i?.version ?? "unknown",
      // @ts-ignore
      eScanMessageType: bMatch?.groups?.messageType,
      elineCode: cMatch?.groups?.elineCode ?? "",
      // @ts-ignore
      tagProtocol: xMatch?.groups?.protocol, //"0" | "1" | "2" | "3" | "4" | "5" | "6" | "7";
      serialNumber: yMatch?.groups?.serialNum ?? "",
      eScanBatteryVoltageMillivolt: "", // eScan only
      eScanUsbVoltageMillivolt: "", // eScan only
      eScanBatteryPercentage: "", // eScan only
      eScanISODate: uMatch?.groups?.date ?? "", // eScan only, ISO date
      timeMilliseconds: wMatch?.groups?.time ?? "", // milliseconds since EPOCH
      statusMessageAndEvent: "", // eScan only
      ecuFirstMessageNumberToday: 0, // ECU only
      ecuTotalMessagesToday: 0, // ECU only
    };
  }

  parseDumpTag(frameData: Uint8Array): DumpTagFrame {
    // Parse header

    // Parse rest depending on protocol

    return {};
  }

  /**
   * Checks whether new chunks can be found within the binary data.
   */
  checkForChunks(completeReadingPosition: number) {
    const frameSize = ringBufferReadLength(
      this.data.byteLength,
      this.readPosition,
      completeReadingPosition,
    );

    const range = getRangeFromRingBuffer(
      this.data,
      this.readPosition,
      frameSize,
    );

    let frame = {};
    const nByte = 0x4e; // letter N
    const iByte = 0x49; // letter I
    if (this.data[this.readPosition] === nByte) {
      frame = this.parseDumpTag(range);
    } else if (this.data[this.readPosition] === iByte) {
      frame = this.parseFrame(range);
    } else {
      console.error("Unknown starting byte", this.data[this.readPosition]);
    }
    console.log(
      `Frame: ${frameSize}, datalength: ${this.data.byteLength}, readPos: ${this.readPosition}, finPos: ${completeReadingPosition}`,
      frame,
      new TextDecoder("utf-8").decode(
        getRangeFromRingBuffer(this.data, this.readPosition, frameSize),
      ),
    );
    this.onChunk && this.onChunk(frame);
  }
}

/**
 * This transform stream unpacks objects of frames from an eScan device.
 *
 * Unfortunately this does not work at the moment, it seems that the streaming takes
 * to much time, and as a result we got package loss. Use the `EmitEscanUnpacker`
 * directly instead.
 *
 * It can be consumed by a ReadableStream's pipeThrough method.
 */
export class EmitEscanTransformStream extends TransformStream<
  ArrayBuffer,
  UsbFrame | DumpTagFrame
> {
  constructor() {
    const unpacker = new EmitEscanUnpacker();

    super({
      start(controller) {
        unpacker.onChunk = (chunk) => controller.enqueue(chunk);
      },
      transform(arrayBuffer) {
        unpacker.addBinaryData(new Uint8Array(arrayBuffer));
      },
    });
  }
}
