import {
  Ecard250,
  EmitEkt250TransformStream,
  Mtr4TransformStream,
  serialOptions250,
  serialOptionsMtr4,
  EcardMtr,
  MtrStatusMessage,
  PackageType,
} from "@mikaello/emit-punch-cards-communication";
import { SerialPort, SerialOptions } from "./serial-types";
import { getStatusCommand } from "@mikaello/emit-punch-cards-communication/dist/mtr4-commands";

let port250: SerialPort | null = null;
let inputDone250: Promise<void> | null = null;
let reader250: ReadableStreamReader<Ecard250> | null = null;

let portMtr4: SerialPort | null = null;
let inputDoneMtr4: Promise<void> | null = null;
let readerMtr4: ReadableStreamReader<EcardMtr | MtrStatusMessage> | null = null;

export const connect250 = async () => {
  try {
    port250 = await navigator.serial.requestPort({
      /* filters: [
          {
            vendorId: 0x0403, // FTDI
            productId: 0x6001,
          },
        ],*/
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
      readerMtr4,
      inputDoneMtr4,
      portMtr4,
    );
  }
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

window.connect250 = connect250;
window.connectMtr4 = connectMtr4;
window.disconnect250 = disconnect250;
window.disconnectMtr4 = disconnectMtr4;
