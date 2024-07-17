export interface SerialOptions {
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
  stopBits?: 1 | 2;
  dataBits?: 8 | 7 | 6 | 5;
  parity?: (typeof ParityType)[keyof typeof ParityType];
  bufferSize?: number;
  rtscts?: boolean;
  xon?: boolean;
  xoff?: boolean;
  xany?: boolean;
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
  /** An unsigned short integer that identifies a USB device vendor. */
  usbVendorId: number;
  /** An unsigned short integer that identifies a USB device. */
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
    NONE: "none";
    EVEN: "even";
    ODD: "odd";
    MARK: "mark";
    SPACE: "space";
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
