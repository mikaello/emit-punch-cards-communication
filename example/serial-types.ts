/** @see https://wicg.github.io/serial/#serialoptions-dictionary */
export interface SerialOptions {
  /** The baud rate at which serial communication should be established. */
  baudRate:
    | 115200
    | 57600
    | 38400
    | 19200
    | 9600
    | 4800
    | 2400
    | 1800
    | 1200
    | 600
    | 300
    | 200
    | 150
    | 134
    | 110
    | 75
    | 50;
  /** The number of stop bits at the end of the frame. Defaults to 1. */
  stopBits?: 1 | 2;
  /** The number of data bits per frame. Defaults to 8. */
  dataBits?: 7 | 8;
  parity?: (typeof ParityType)[keyof typeof ParityType];
  /** An unsigned long integer indicating the size of the read and write buffers that are to be established (must be less than 16MB). Defaults to 255. */
  bufferSize?: number;
  /** The flow control mode. */
  flowControl?: (typeof FlowControl)[keyof typeof FlowControl];
}

interface SerialPortInfo {
  readonly serialNumber: string;
  readonly manufacturer: string;
  readonly locationId: string;
  readonly vendorId: string;
  readonly vendor: string;
  readonly productId: string;
  readonly product: string;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Serial/requestPort
 * @see https://wicg.github.io/serial/#serialportrequestoptions-dictionary
 */
export interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

/**
 * @see https://wicg.github.io/serial/#serialportfilter-dictionary
 */
export interface SerialPortFilter {
  /** USB Vendor ID */
  usbVendorId: number;
  /** USB Product ID */
  usbProductId: number;
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SerialPort
 * @see https://wicg.github.io/serial/#serialport-interface
 */
export interface SerialPort {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  readonly in: ReadableStream;
  readonly out: WritableStream;
  getInfo(): SerialPortInfo;
}

declare global {
  interface Window {
    connect250: () => void;
    connectMtr4: () => void;
    connectEscan: () => void;
    disconnect250: () => void;
    disconnectMtr4: () => void;
    disconnectEscan: () => void;
  }

  export const ParityType: {
    /** No parity bit is sent for each data word. */
    NONE: "none";
    /** Data word plus parity bit has even parity. */
    EVEN: "even";
    /** Data word plus parity bit has odd parity. */
    ODD: "odd";
  };

  export const FlowControl: {
    /** No flow control is enabled. */
    NONE: "none";
    /** Hardware flow control using the RTS and CTS signals is enabled. */
    HARDWARE: "hardware";
  };

  interface Navigator {
    serial: {
      onconnect: EventHandlerNonNull;
      ondisconnect: EventHandlerNonNull;
      requestPort(
        options: SerialPortRequestOptions | undefined,
      ): Promise<SerialPort>;
      getPorts(): Promise<Iterable<SerialPort>>;
    };
  }
}

interface EventHandlerNonNull {
  (event: Event): any;
}
