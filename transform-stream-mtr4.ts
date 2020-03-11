export const serialOptionsMtr4 = {
  baudrate: 9600,
  stopbits: 1,
  parity: "none",
  databits: 8,
};

class Mtr4Unpacker {
  onChunk: null | ((chunk: Uint8Array) => void);

  consoleData: Uint8Array;
  timeout: any | null;

  constructor() {
    this.onChunk = null;
    this.consoleData = new Uint8Array(0);
    this.timeout = null;
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

  addBinaryData(uint8Array: Uint8Array) {
    this.printDataToConsole(uint8Array);

    if (this.onChunk) {
      this.onChunk(uint8Array);
    }
  }
}

export class Mtr4TransformStream extends TransformStream {
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
