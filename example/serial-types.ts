export interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: {
    baudRate: number;
    stopBits?: number;
    parity?: string;
    dataBits?: number;
  }): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Navigator {
    serial?: { requestPort(): Promise<SerialPort> };
  }
}
