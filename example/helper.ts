import {
  EmitEkt250TransformStream,
  EmitEscanUnpacker,
  EmitEscan2TransformStream,
  Mtr4TransformStream,
  PackageType,
  escanCommands,
  escan2Commands,
  mtr4Commands,
  serialOptions250,
  serialOptionsMtr4,
  serialOptionsEscan2,
  type Ecard250,
  type EcardMtr,
  type MtrStatusMessage,
  type Escan2Frame,
  type Escan2Dump,
} from "@mikaello/emit-punch-cards-communication";
import type { SerialOptions, SerialPort } from "./serial-types";

let port250: SerialPort | undefined;
let reader250: ReadableStreamDefaultReader<Ecard250> | undefined;
let portMtr4: SerialPort | undefined;
let readerMtr4:
  ReadableStreamDefaultReader<EcardMtr | MtrStatusMessage> | undefined;
let escanDevice: USBDevice | undefined;
let escanDisconnecting = false;
let portEscan2: SerialPort | undefined;
let readerEscan2: ReadableStreamDefaultReader<Escan2Frame> | undefined;
let escan2CommandQueue = Promise.resolve();

function setConnected(device: string, connected: boolean) {
  document.querySelector<HTMLButtonElement>(`#connect-${device}`)!.disabled =
    connected;
  document.querySelector<HTMLButtonElement>(`#disconnect-${device}`)!.disabled =
    !connected;
  if (device === "escan2") {
    for (const action of ["today", "all", "stop"]) {
      document.querySelector<HTMLButtonElement>(`#escan2-${action}`)!.disabled =
        !connected;
    }
  }
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

function appendEscan2Card(card: Escan2Dump) {
  const production =
    card.tagType === "eCard" ? /-(\d{2})(\d{2})$/.exec(card.power) : null;
  const row = document.createElement("tr");
  for (const value of [
    card.cardNumber,
    production?.[2] ?? "",
    production?.[1] ?? "",
    card.punches.map(({ code }) => code).join(", "),
  ]) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    row.append(cell);
  }
  document.querySelector("#emit-card-list-body")!.prepend(row);
  document.querySelector("#last-read-device")!.textContent =
    `Last ${card.tagType} read from eScan2 (${card.validChecksum ? "checksum OK" : "checksum mismatch"})`;
}

function sendEscan2Command(command: Uint8Array) {
  const port = portEscan2;
  if (!port?.writable) return Promise.resolve();
  const pending = escan2CommandQueue.then(async () => {
    const writer = port.writable!.getWriter();
    try {
      await writer.write(command);
    } finally {
      writer.releaseLock();
    }
  });
  escan2CommandQueue = pending.catch(() => {});
  return pending;
}

export async function connectEscan2() {
  if (!navigator.serial) return showError("Web Serial is unavailable");
  try {
    const port = await navigator.serial.requestPort();
    await port.open(serialOptionsEscan2 as SerialOptions);
    portEscan2 = port;
    setConnected("escan2", true);
    const transform = new EmitEscan2TransformStream();
    const inputDone = port.readable!.pipeTo(transform.writable).catch(() => {});
    const reader = transform.readable.getReader();
    readerEscan2 = reader;
    try {
      await sendEscan2Command(escan2Commands.getStatusCommand());
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.kind === "status") {
          showStatus("#last-escan2-status", value);
        } else if (value.kind === "dump") {
          appendEscan2Card(value);
        } else {
          showStatus("#last-escan2-passing", value);
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
    readerEscan2 = undefined;
    setConnected("escan2", false);
    if (portEscan2) await portEscan2.close().catch(showError);
    portEscan2 = undefined;
  }
}

export async function disconnectEscan2() {
  await readerEscan2?.cancel();
}

export async function spoolEscan2Today() {
  await sendEscan2Command(escan2Commands.getTodayCommand()).catch(showError);
}

export async function spoolEscan2All() {
  await sendEscan2Command(escan2Commands.getAllCommand()).catch(showError);
}

export async function stopEscan2Spool() {
  await sendEscan2Command(escan2Commands.getStopCommand()).catch(showError);
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
document
  .querySelector("#connect-escan2")!
  .addEventListener("click", connectEscan2);
document
  .querySelector("#disconnect-escan2")!
  .addEventListener("click", disconnectEscan2);
document
  .querySelector("#escan2-today")!
  .addEventListener("click", spoolEscan2Today);
document
  .querySelector("#escan2-all")!
  .addEventListener("click", spoolEscan2All);
document
  .querySelector("#escan2-stop")!
  .addEventListener("click", stopEscan2Spool);
