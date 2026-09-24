/** @see https://wicg.github.io/serial/#serialoptions-dictionary */
export interface SerialOptions {
  /** Required positive baud rate for the connection. */
  baudRate: number;
  /** Defaults to 1. */
  stopBits?: 1 | 2;
  /** Defaults to 8. */
  dataBits?: 7 | 8;
  /** Defaults to "none". */
  parity?: "none" | "even" | "odd";
  /** Read and write buffer size in bytes; defaults to 255. */
  bufferSize?: number;
  /** Defaults to "none". */
  flowControl?: "none" | "hardware";
}

/** @see https://wicg.github.io/serial/#serialportinfo-dictionary */
export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
}

/** @see https://wicg.github.io/serial/#serialportfilter-dictionary */
export interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
}

/** @see https://wicg.github.io/serial/#serialportrequestoptions-dictionary */
export interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
  allowedBluetoothServiceClassIds?: Array<number | string>;
}

/** @see https://wicg.github.io/serial/#serialport-interface */
export interface SerialPort {
  readonly connected: boolean;
  /** Null before opening or after a fatal read error. */
  readonly readable: ReadableStream<Uint8Array> | null;
  /** Null while the port is closed. */
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  getInfo(): SerialPortInfo;
}

/** @see https://wicg.github.io/serial/#serial-interface */
export interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}
