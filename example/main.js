import {
  EmitEkt250TransformStream,
  EmitEscanUnpacker,
  Mtr4TransformStream,
  escanCommands,
  mtr4Commands,
  serialOptions250,
  serialOptionsMtr4,
} from "@mikaello/emit-punch-cards-communication";

const output = document.querySelector("#output");
const serialConnections = new Map();
let escanDevice;
let escanDisconnecting = false;

function show(device, value) {
  output.textContent = `${device}: ${JSON.stringify(value)}\n${output.textContent}`;
}

function setConnected(device, connected) {
  document.querySelector(`#connect-${device}`).disabled = connected;
  document.querySelector(`#disconnect-${device}`).disabled = !connected;
}

async function connectSerial(device, options, transform) {
  if (!navigator.serial) {
    show(device, "Web Serial is unavailable in this browser");
    return;
  }

  let port;
  try {
    port = await navigator.serial.requestPort();
    await port.open(options);
    const inputDone = port.readable.pipeTo(transform.writable).catch(() => {});
    const reader = transform.readable.getReader();
    serialConnections.set(device, { reader });
    setConnected(device, true);

    try {
      if (device === "mtr4") {
        const writer = port.writable.getWriter();
        try {
          await writer.write(mtr4Commands.getStatusCommand());
        } finally {
          writer.releaseLock();
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        show(device, value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
      await inputDone;
    }
  } catch (error) {
    if (error.name !== "NotFoundError") show(device, error.message);
  } finally {
    serialConnections.delete(device);
    setConnected(device, false);
    if (port?.readable || port?.writable) await port.close();
  }
}

async function connectEscan() {
  if (!navigator.usb) {
    show("escan", "WebUSB is unavailable in this browser");
    return;
  }

  let device;
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
      escanCommands.createUSBCommand(escanCommands.USBCommand.GREEN),
    );
    escanDevice = device;
    setConnected("escan", true);

    const unpacker = new EmitEscanUnpacker();
    unpacker.onChunk = (frame) => show("escan", frame);
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
    if (error.name !== "NotFoundError" && !escanDisconnecting) {
      show("escan", error.message);
    }
  } finally {
    if (escanDevice === device) escanDevice = undefined;
    escanDisconnecting = false;
    setConnected("escan", false);
    if (device?.opened) await device.close();
  }
}

document.querySelector("#connect-250").onclick = () =>
  connectSerial("250", serialOptions250, new EmitEkt250TransformStream(false));
document.querySelector("#connect-mtr4").onclick = () =>
  connectSerial("mtr4", serialOptionsMtr4, new Mtr4TransformStream());
document.querySelector("#connect-escan").onclick = connectEscan;
document.querySelector("#disconnect-250").onclick = () =>
  serialConnections.get("250")?.reader.cancel();
document.querySelector("#disconnect-mtr4").onclick = () =>
  serialConnections.get("mtr4")?.reader.cancel();
document.querySelector("#disconnect-escan").onclick = () => {
  escanDisconnecting = true;
  return escanDevice?.close();
};
