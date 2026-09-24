import {
  EmitEkt250TransformStream,
  EmitEscanUnpacker,
  Mtr4TransformStream,
  PackageType,
  escanCommands,
  mtr4Commands,
  serialOptions250,
  serialOptionsMtr4,
  type Ecard250,
  type EcardMtr,
  type MtrStatusMessage,
} from "@mikaello/emit-punch-cards-communication";
import type { SerialOptions, SerialPort } from "./serial-types";

let port250: SerialPort | undefined;
let reader250: ReadableStreamDefaultReader<Ecard250> | undefined;
let portMtr4: SerialPort | undefined;
let readerMtr4:
  ReadableStreamDefaultReader<EcardMtr | MtrStatusMessage> | undefined;
let escanDevice: USBDevice | undefined;
let escanDisconnecting = false;

function setConnected(device: string, connected: boolean) {
  document.querySelector<HTMLButtonElement>(`#connect-${device}`)!.disabled =
    connected;
  document.querySelector<HTMLButtonElement>(`#disconnect-${device}`)!.disabled =
    !connected;
}

function showError(error: unknown) {
  if (error instanceof Error && error.name === "NotFoundError") return;
  document.querySelector("#connection-status")!.textContent = String(error);
}

function appendCard(device: string, card: Ecard250 | EcardMtr) {
  const row = document.createElement("tr");
  for (const value of [
    card.ecardNumber,
    card.ecardProductionYear,
    card.ecardProductionWeek,
    card.controlCodes.map(({ code }) => code).join(", "),
  ]) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.append(cell);
  }
  document.querySelector("#emit-card-list-body")!.prepend(row);
  document.querySelector("#last-read-device")!.textContent =
    `Last card read from ${device}`;
}

function showStatus(selector: string, status: object) {
  const list = document.querySelector(selector)!;
  list.replaceChildren();
  for (const [name, value] of Object.entries(status)) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = name;
    description.textContent = String(value);
    list.append(term, description);
  }
}

export async function connect250() {
  if (!navigator.serial) return showError("Web Serial is unavailable");
  try {
    const port = await navigator.serial.requestPort();
    await port.open(serialOptions250 as SerialOptions);
    port250 = port;
    setConnected("250", true);

    const transform = new EmitEkt250TransformStream(false);
    const inputDone = port.readable!.pipeTo(transform.writable).catch(() => {});
    const reader = transform.readable.getReader();
    reader250 = reader;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        appendCard("250", value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
      await inputDone;
    }
  } catch (error) {
    showError(error);
  } finally {
    reader250 = undefined;
    setConnected("250", false);
    if (port250) await port250.close().catch(showError);
    port250 = undefined;
  }
}

export async function disconnect250() {
  await reader250?.cancel();
}

export async function connectMtr4() {
  if (!navigator.serial) return showError("Web Serial is unavailable");
  try {
    const port = await navigator.serial.requestPort();
    await port.open(serialOptionsMtr4 as SerialOptions);
    portMtr4 = port;
    setConnected("mtr4", true);

    const transform = new Mtr4TransformStream();
    const inputDone = port.readable!.pipeTo(transform.writable).catch(() => {});
    const reader = transform.readable.getReader();
    readerMtr4 = reader;
    try {
      const writer = port.writable!.getWriter();
      try {
        await writer.write(mtr4Commands.getStatusCommand());
      } finally {
        writer.releaseLock();
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.packageType === PackageType.EcardMtr) {
          appendCard("MTR4", value);
        } else {
          showStatus("#last-mtr4-status", value);
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
      await inputDone;
    }
  } catch (error) {
    showError(error);
  } finally {
    readerMtr4 = undefined;
    setConnected("mtr4", false);
    if (portMtr4) await portMtr4.close().catch(showError);
    portMtr4 = undefined;
  }
}

export async function disconnectMtr4() {
  await readerMtr4?.cancel();
}

export async function connectEscan() {
  if (!navigator.usb) return showError("WebUSB is unavailable");
  let device: USBDevice | undefined;
  escanDisconnecting = false;
  try {
    device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x2047, productId: 0x300 }],
    });
    await device.open();
    if (!device.configuration) await device.selectConfiguration(1);
    await device.claimInterface(0);
    await device.transferOut(
      3,
      new Uint8Array(
        escanCommands.createUSBCommand(escanCommands.USBCommand.GREEN),
      ),
    );
    escanDevice = device;
    setConnected("escan", true);

    const unpacker = new EmitEscanUnpacker();
    unpacker.onChunk = (frame) => {
      if ("productName" in frame) showStatus("#last-escan-status", frame);
    };
    while (escanDevice === device) {
      const result = await device.transferIn(3, 64);
      if (result.status === "stall") {
        await device.clearHalt("in", 3);
      } else if (result.data) {
        unpacker.addBinaryData(
          new Uint8Array(
            result.data.buffer,
            result.data.byteOffset,
            result.data.byteLength,
          ),
        );
      }
    }
  } catch (error) {
    if (!escanDisconnecting) showError(error);
  } finally {
    if (escanDevice === device) escanDevice = undefined;
    escanDisconnecting = false;
    setConnected("escan", false);
    if (device?.opened) await device.close().catch(showError);
  }
}

export async function disconnectEscan() {
  const device = escanDevice;
  if (!device) return;
  escanDisconnecting = true;
  escanDevice = undefined;
  await device.close().catch(showError);
}

document.querySelector("#connect-250")!.addEventListener("click", connect250);
document
  .querySelector("#disconnect-250")!
  .addEventListener("click", disconnect250);
document.querySelector("#connect-mtr4")!.addEventListener("click", connectMtr4);
document
  .querySelector("#disconnect-mtr4")!
  .addEventListener("click", disconnectMtr4);
document
  .querySelector("#connect-escan")!
  .addEventListener("click", connectEscan);
document
  .querySelector("#disconnect-escan")!
  .addEventListener("click", disconnectEscan);
