export interface SerialOptions {
  baudrate?:
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
  stopbits?: 1 | 2;
  databits?: 8 | 7 | 6 | 5;
  parity?: typeof ParityType[keyof typeof ParityType];
  buffersize?: number;
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
      requestPort(options: SerialOptions): Promise<SerialPort>;
      getPorts(): Promise<Iterable<SerialPort>>;
    };
  }
}

interface EventHandlerNonNull {
  (event: Event): any;
}
