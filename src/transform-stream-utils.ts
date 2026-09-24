export enum BatteryStatus {
  OK = 0,
  Low = 1,
}

export enum PackageType {
  StatusMessage = "S",
  EcardMtr = "M",
}

/**
 * Get control codes from a `DataView` with controls ordered in chunks of three
 * bytes: first byte is control code, the next two bytes are the time from previous
 * control to this one.
 *
 * @param view control codes with corresponding times
 * @return an array with objects corresponding to the controls in the view
 */
export const getControlCodeInformation = (view: DataView) => {
  let codes: Array<{ code: number; time: number }> = [];
  for (let i = 0; i < view.byteLength; i += 3) {
    const code = view.getUint8(i);

    if (i > 0 && code === 0) {
      /*
       * Only the first control can have code 0. The next occurrence of code 0
       * means that we are finished reading controls.
       */
      break;
    }

    const time = (view.getUint8(i + 2) << 8) | view.getUint8(i + 1);
    codes.push({ code, time });
  }

  if (codes.length > 0) {
    /*
     * The last stamped code will occur in duplicates (number of duplicates will
     * depend on how long the runner let his runner unit be on the EKT-device).
     *
     * Only collapse the trailing run: an earlier visit to this control may
     * belong to a different leg of the course.
     */
    const { code: finishCode } = codes[codes.length - 1];
    let firstFinalPunch = codes.length - 1;
    while (
      firstFinalPunch > 0 &&
      codes[firstFinalPunch - 1].code === finishCode
    ) {
      firstFinalPunch--;
    }
    codes = codes.slice(0, firstFinalPunch + 1);
  }

  return codes;
};

/** Start of reading, RTX byte */
export const USB_START_READ_BYTE = 0x02;

/** End of reading, ETX byte */
export const USB_STOP_READ_BYTE = 0x03;

/**
 * Get ringbuffer index for given byte in new byte data.
 *
 * @param ringBufferSize current ringbuffer size
 * @param writePositionNewBytes write position before new bytes are added
 * @param newBytes bytes to be added to ringbuffer
 * @param byte which byte to check existence for in new data
 * @return ringbuffer index of new read or write position if found, else return `null`
 */
export const getByteIndexInNewRingbufferData = (
  ringBufferSize: number,
  writePositionNewBytes: number,
  newBytes: Uint8Array,
  byte: number,
): null | number => {
  const maybeNewBytePos = newBytes.findIndex((newByte) => newByte === byte);

  if (maybeNewBytePos == -1) {
    return null;
  }

  return (writePositionNewBytes + maybeNewBytePos + 1) % ringBufferSize;
};

/**
 * Calculates how many bytes the current reading consists of
 *
 * @param bufferSize size of ring buffer
 * @param readStart index of read start (inclusive)
 * @param readStop index of read stop (exclusive)
 */
export const ringBufferReadLength = (
  bufferSize: number,
  readStart: number,
  readStop: number,
) => {
  if (readStart <= readStop) {
    return readStop - readStart;
  }

  const endOfBuffer = bufferSize - readStart;

  return endOfBuffer + readStop;
};

/** Leave one slot empty so the write position cannot wrap onto an unread frame. */
export const assertRingBufferHasSpace = (
  bufferSize: number,
  readPosition: number,
  writePosition: number,
) => {
  if (
    ringBufferReadLength(bufferSize, readPosition, writePosition) >=
    bufferSize - 1
  ) {
    throw new Error("Ring buffer overflow: incomplete frame exceeds capacity");
  }
};

/**
 * Returns an `Uint8Array` with the bytes from the ringbuffer that corresponds
 * to the given offset and length.
 */
export const getRangeFromRingBuffer = (
  ringBuffer: Uint8Array,
  offset: number,
  length: number,
) => {
  if (offset + length <= ringBuffer.byteLength) {
    return ringBuffer.slice(offset, offset + length);
  }

  const start = ringBuffer.slice(offset);
  const end = ringBuffer.slice(0, (offset + length) % ringBuffer.byteLength);

  const range = new Uint8Array(length);
  range.set(start, 0);
  range.set(end, start.byteLength);

  return range;
};

export const getMessageType = (
  ringBuffer: Uint8Array,
  offset: number,
  messageTypeOffset: number,
) => {
  const typeIndex = (offset + messageTypeOffset) % ringBuffer.byteLength;
  const typeValue = ringBuffer[typeIndex];
  if (typeValue === 0x53) {
    return PackageType.StatusMessage;
  } else if (typeValue === 0x4d) {
    return PackageType.EcardMtr;
  } else {
    return null;
  }
};
