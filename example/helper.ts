import { Ecard, EmitEkt250TransformStream } from "../transform-stream-250.js"; // .js needed for browser
import { SerialPort } from "./serial-types";

let port: SerialPort | null = null;
var inputDone: Promise<void> | null = null;
let reader: ReadableStreamReader<Ecard> | null = null;

export let connect = async () => {
  try {
    port = await navigator.serial.requestPort({
      /* filters: [
          {
            vendorId: 0x0403, // FTDI
            productId: 0x6001,
          },
        ],*/
    });

    await port.open({
      baudrate: 9600,
      stopbits: 2,
      parity: "none",
      databits: 8,
    });

    let emitTransformer = new EmitEkt250TransformStream();
    inputDone = port.readable
      .pipeThrough<Uint8Array>(new OdTransformStream())
      .pipeTo(emitTransformer.writable);
    reader = emitTransformer.readable.getReader();

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        console.log("[readLoop] DONE", done);
        break;
      }

      if (value) {
        console.log("value", value);
        const element = document.getElementById("last-read-device");
        element.innerText = value.ecardNumber + "";
      }
    }

    reader.releaseLock();
  } catch (e) {
    console.error("serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export let disconnect = async () => {
  if (reader && inputDone && port) {
    await reader.cancel();
    await inputDone.catch(() => {});
    reader = null;
    inputDone = null;

    await port?.close();
    port = null;
  } else {
    console.log("something is not defined");
  }
};

/**
 * This transform stream XOR-s all bytes with OD (255-32), which is required by the spec.
 *
 * It can be consumed by a ReadableStream's pipeThrough method.
 */
class OdTransformStream extends TransformStream {
  constructor() {
    const od = 255 - 32;
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk.map(byte => byte ^ od));
      },
    });
  }
}

window.connect = connect;
window.disconnect = disconnect;
