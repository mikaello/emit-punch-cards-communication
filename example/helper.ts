import {
  Ecard,
  EmitEkt250TransformStream,
  serialOptions250,
} from "../transform-stream-250.js"; // .js needed for browser
import { getSetClockCommand, getStatusCommand } from "../mtr4-commands.js"; // .js needed
import {
  serialOptionsMtr4,
  Mtr4TransformStream,
} from "../transform-stream-mtr4.js"; // .js needed
import { SerialPort, SerialOptions } from "./serial-types";

let port250: SerialPort | null = null;
let inputDone250: Promise<void> | null = null;
let reader250: ReadableStreamReader<Ecard> | null = null;

let portMtr4: SerialPort | null = null;
let inputDoneMtr4: Promise<void> | null = null;
let readerMtr4: ReadableStreamReader<Ecard> | null = null;

export let connect250 = async () => {
  try {
    port250 = await navigator.serial.requestPort({
      /* filters: [
          {
            vendorId: 0x0403, // FTDI
            productId: 0x6001,
          },
        ],*/
    });

    await port250.open(<SerialOptions>serialOptions250);

    let emitTransformer = new EmitEkt250TransformStream();
    inputDone250 = port250.readable.pipeTo(emitTransformer.writable);
    reader250 = emitTransformer.readable.getReader();

    while (true) {
      const { value, done } = await reader250.read();

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

    reader250.releaseLock();
  } catch (e) {
    console.error("serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export let disconnect250 = async () => {
  if (reader250 && inputDone250 && port250) {
    await reader250.cancel();
    await inputDone250.catch(() => {});
    reader250 = null;
    inputDone250 = null;

    await port250?.close();
    port250 = null;
  } else {
    console.error(
      "something is not defined when disconnecting 250 (reader/inputDone/port)",
      readerMtr4,
      inputDoneMtr4,
      portMtr4,
    );
  }
};

export let connectMtr4 = async () => {
  try {
    portMtr4 = await navigator.serial.requestPort({
      /* filters: [
          {
            vendorId: 0x0403, // FTDI
            productId: 0x6001,
          },
        ],*/
    });

    console.log(portMtr4);

    await portMtr4.open(<SerialOptions>serialOptionsMtr4);

    let emitTransformer = new Mtr4TransformStream();
    inputDoneMtr4 = portMtr4.readable.pipeTo(emitTransformer.writable);
    readerMtr4 = emitTransformer.readable.getReader();

    let ts = new TransformStream();
    ts.readable.pipeTo(portMtr4.writable);
    let writer = ts.writable.getWriter();
    writer.write(getStatusCommand());
    writer.releaseLock();

    while (true) {
      const { value, done } = await readerMtr4.read();

      if (done) {
        console.log("[readLoop] DONE", done);
        break;
      }

      if (value) {
        //console.log("value " + value.length, value);
        //const element = document.getElementById("last-read-device");
        //element.innerText = value.ecardNumber + "";
      }
    }

    readerMtr4.releaseLock();
  } catch (e) {
    console.error("serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export let disconnectMtr4 = async () => {
  if (readerMtr4 && inputDoneMtr4 && portMtr4) {
    await readerMtr4.cancel();
    await inputDoneMtr4.catch(() => {});
    readerMtr4 = null;
    inputDoneMtr4 = null;

    await portMtr4?.close();
    portMtr4 = null;
  } else {
    console.error(
      "something is not defined when disconnecting MTR4 (reader/inputDone/port)",
      readerMtr4,
      inputDoneMtr4,
      portMtr4,
    );
  }
};

window.connect250 = connect250;
window.connectMtr4 = connectMtr4;
window.disconnect250 = disconnect250;
window.disconnectMtr4 = disconnectMtr4;
