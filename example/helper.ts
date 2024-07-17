import {
  Ecard250,
  EmitEkt250TransformStream,
  Mtr4TransformStream,
  serialOptions250,
  serialOptionsMtr4,
  EcardMtr,
  MtrStatusMessage,
  PackageType,
  EmitEscanUnpacker,
  UsbFrame,
} from "@mikaello/emit-punch-cards-communication";
import { SerialPort, SerialOptions } from "./serial-types";
import { getStatusCommand } from "@mikaello/emit-punch-cards-communication/dist/mtr4-commands";
import {
  createUSBCommand,
  USBCommand,
} from "@mikaello/emit-punch-cards-communication/dist/escan-commands";

let port250: SerialPort | null = null;
let inputDone250: Promise<void> | null = null;
let reader250: ReadableStreamReader<Ecard250> | null = null;

let portMtr4: SerialPort | null = null;
let inputDoneMtr4: Promise<void> | null = null;
let readerMtr4: ReadableStreamReader<EcardMtr | MtrStatusMessage> | null = null;

let escanUsbDevice: USBDevice | null = null;
const ESCAN_USB_INTERFACE = 0;
const ESCAN_USB_CONFIGURATION = 1;
const ESCAN_USB_BULK_ENDPOINT = 3;
const disconnectEventListener = async () => await disconnectEscan();

export const connect250 = async () => {
  try {
    port250 = await navigator.serial.requestPort({
       filters: [
          {
            usbVendorId: 0x0403, // FTDI
            usbProductId: 0x6001,
          },
        ],
    });

    console.log("250 port acquired", port250);

    await port250.open(<SerialOptions>serialOptions250);
    toggleHtmlElementsWithId(["connect-device-250", "disconnect-device-250"]);

    let emitTransformer = new EmitEkt250TransformStream(false);
    inputDone250 = port250.readable.pipeTo(emitTransformer.writable);
    reader250 = emitTransformer.readable.getReader();

    while (true) {
      const { value, done } = await reader250.read();

      if (done) {
        console.log("[readLoop] DONE", done);
        break;
      }

      if (value) {
        console.log("250 value", value);
        appendCardToList(value);
      }
    }

    reader250.releaseLock();
  } catch (e) {
    console.error("250 serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export const disconnect250 = async () => {
  if (reader250 && inputDone250 && port250) {
    await reader250.cancel();
    await inputDone250.catch(() => {});
    reader250 = null;
    inputDone250 = null;

    await port250?.close();
    port250 = null;
    toggleHtmlElementsWithId(["connect-device-250", "disconnect-device-250"]);
  } else {
    console.error(
      "something is not defined when disconnecting 250 (reader/inputDone/port)",
      reader250,
      inputDone250,
      port250,
    );
  }
};

/** @see https://developers.google.com/web/updates/2016/03/access-usb-devices-on-the-web */
export const connectEscan = async () => {
  try {
    escanUsbDevice = await navigator.usb.requestDevice({
      filters: [
        {
          vendorId: 0x2047, // EMIT
          productId: 0x300, // eScan
        },
      ],
    });
    console.log("eScan acquired", escanUsbDevice);

    await escanUsbDevice.open();
    toggleHtmlElementsWithId([
      "connect-device-escan",
      "disconnect-device-escan",
    ]);

    navigator.usb.addEventListener("disconnect", disconnectEventListener);

    if (escanUsbDevice.configuration === null) {
      await escanUsbDevice.selectConfiguration(ESCAN_USB_CONFIGURATION);
    }
    await escanUsbDevice.claimInterface(ESCAN_USB_INTERFACE);
    await escanUsbDevice.transferOut(
      ESCAN_USB_BULK_ENDPOINT,
      createUSBCommand(USBCommand.GREEN),
    );

    const unpack = new EmitEscanUnpacker();
    unpack.onChunk = (chunk: UsbFrame) => {
      if (chunk.productName != null) {
        addLastEscanStatus(chunk);
      }
    };

    // const pieces = [];
    while (true) {
      const result = await escanUsbDevice.transferIn(
        ESCAN_USB_BULK_ENDPOINT,
        64,
      );

      if (result.status === "stall") {
        console.warn("Endpoint stalled. Clearing.");
        await escanUsbDevice.clearHalt("in", ESCAN_USB_BULK_ENDPOINT);
      } else {
        const buff = new Uint8Array(result.data.buffer);
        unpack.addBinaryData(buff);
      }

      /*

      if (result.status === "ok") {
        if (
          buff.length === 3 &&
          buff[0] == 3 &&
          buff[1] == 13 &&
          buff[2] == 10
        ) {
          pieces.push(result.data.buffer);
          console.log(
            "Bytes",
            pieces.map((p) => new Uint8Array(p).toString()),
          );
          console.log(decoder.decode(concatArrayBuffers(pieces)));
          pieces = [];
        } else {
          pieces.push(result.data.buffer);
        }
      }*/

      /*
      console.log(
        "Received: ",
        decoder.decode(result.data).padEnd(15),
        "Bytes: <" + (new Uint8Array(result.data.buffer)).toString() + ">",
      );
      */

      /*

      */
    }
  } catch (e) {
    console.error("eScan Web USB", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export const disconnectEscan = async () => {
  if (escanUsbDevice) {
    try {
      await escanUsbDevice.close();
    } catch {
      console.log("eScan already closed when attempting.");
    }
    escanUsbDevice = null;
    toggleHtmlElementsWithId([
      "connect-device-escan",
      "disconnect-device-escan",
    ]);
  } else {
    console.error(
      "something is not defined when disconnecting eScan",
      escanUsbDevice,
    );
  }

  navigator.usb.removeEventListener("disconnect", disconnectEventListener);
};

export const connectMtr4 = async () => {
  try {
    portMtr4 = await navigator.serial.requestPort({
      /* filters: [
          {
            vendorId: 0x0403, // FTDI
            productId: 0x6001,
          },
        ],*/
    });

    console.log("MTR4 port acquired", portMtr4);

    await portMtr4.open(<SerialOptions>serialOptionsMtr4);
    toggleHtmlElementsWithId(["connect-device-mtr4", "disconnect-device-mtr4"]);

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
        console.log("MTR4 value", value);
        if (value.packageType === PackageType.EcardMtr) {
          appendCardToList(value);
        }
      }
    }

    readerMtr4.releaseLock();
  } catch (e) {
    console.error("MTR4 serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export const disconnectMtr4 = async () => {
  if (readerMtr4 && inputDoneMtr4 && portMtr4) {
    await readerMtr4.cancel();
    await inputDoneMtr4.catch(() => {});
    readerMtr4 = null;
    inputDoneMtr4 = null;

    await portMtr4?.close();
    portMtr4 = null;
    toggleHtmlElementsWithId(["connect-device-mtr4", "disconnect-device-mtr4"]);
  } else {
    console.error(
      "something is not defined when disconnecting MTR4 (reader/inputDone/port)",
      readerMtr4,
      inputDoneMtr4,
      portMtr4,
    );
  }
};

const appendCardToList = (ecard: Ecard250 | EcardMtr) => {
  const cardId = document.createElement("td");
  cardId.innerText = ecard.ecardNumber + "";
  const cardYear = document.createElement("td");
  cardYear.innerText = ecard.ecardProductionYear + "";
  const cardWeek = document.createElement("td");
  cardWeek.innerText = ecard.ecardProductionWeek + "";

  const cardRow = document.createElement("tr");
  cardRow.append(cardId, cardYear, cardWeek);

  ecard.controlCodes.forEach(({ code }) => {
    const control = document.createElement("td");
    control.innerText = code + "";
    cardRow.append(control);
  });

  const tableBody = document.getElementById("emit-card-list-body");
  tableBody.prepend(cardRow);
};

const addLastEscanStatus = (frame: UsbFrame) => {
  const createLi = (dt: string, dd: string) => {
    const dtEl = document.createElement("dt");
    const ddEl = document.createElement("dd");
    dtEl.innerText = dt;
    ddEl.innerText = dd;
    return [dtEl, ddEl];
  };

  const status = document.createElement("dl");
  status.append(...createLi("Name", frame.productName));
  status.append(...createLi("HW", frame.hardwareVersion));
  status.append(...createLi("SW", frame.softwareVersion));
  status.append(...createLi("Version", frame.version));
  status.append(...createLi("eLine code", frame.elineCode));
  status.append(...createLi("Serial number", frame.serialNumber));
  status.append(...createLi("Date", frame.eScanISODate));
  status.append(...createLi("Time", frame.timeMilliseconds));

  const lastEscanStatus = document.getElementById("last-escan-status");
  lastEscanStatus.innerHTML = status.outerHTML;
};

const toggleHtmlElementsWithId = (ids: string[]) => {
  ids.forEach((id) => {
    const element = document.getElementById(id);
    if (element.style.display === "none") {
      element.style.display = "initial";
    } else {
      element.style.display = "none";
    }
  });
};

export function concatArrayBuffers(buffers: ArrayBuffer[]) {
  let offset = 0;
  let bytes = 0;
  buffers.forEach(function (buffer) {
    bytes += buffer.byteLength;
  });

  const mergedBuffer = new ArrayBuffer(bytes);
  const store = new Uint8Array(mergedBuffer);
  buffers.forEach(function (buffer) {
    store.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  return mergedBuffer;
}

window.connect250 = connect250;
window.connectMtr4 = connectMtr4;
window.connectEscan = connectEscan;
window.disconnect250 = disconnect250;
window.disconnectMtr4 = disconnectMtr4;
window.disconnectEscan = disconnectEscan;
