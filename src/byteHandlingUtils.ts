/**
 * @param number number to be converted to an array of size 4 bytes
 */
export const int32ToBytes = (number: number) => {
  const buffer = new ArrayBuffer(4); // an Int32 takes 4 bytes
  const view = new DataView(buffer);
  view.setUint32(0, number, true); // byteOffset = 0; litteEndian = true
  return buffer;
};

/**
 * Converts a `DataView` of at most 4 bytes to an integer corresponding to
 * interpreting the array as an integer with the least significant byte first (little endian).
 *
 * @param view DataView with 0 to 4 bytes
 */
export const bytesToInt = (view: DataView) => {
  if (view.byteLength > 4) {
    throw new Error("Can't convert views larger than 4 bytes, got " + view);
  }

  /*
   *  For 8, 16 and 32 bit, this approach could have been used:
   *  view.getUint[8, 16, 32](0, true);
   *
   *  But this next loop suits all of them, and 24 bits as well.
   */

  let number = 0;
  for (let i = 0; i < view.byteLength; i++) {
    number |= view.getUint8(i) << (i * 8);
  }

  return number >>> 0; // convert to unsigned number
};

/**
 * Converts 6 bytes to a JavaScript Date-object. The 6 bytes must be as follows:
 * * `0`, year: values accepted are 90 to 99 (1990..1999) and 0 to 53 (2000..2053)
 * * `1`, month: values accepted are 1 to 12
 * * `2`, daynumber: values accepted are 1 to 31
 * * `3`, hour: values accepted are 0 to 23
 * * `4`, minute: values accepted are 0 59
 * * `5`, second: values accepted are 0 59
 */
export const bytesToDate = (view: DataView) => {
  if (view.byteLength !== 6) {
    throw new Error(
      `Can't convert view ${view.byteLength} bytes to date, got ${view}`,
    );
  }

  // possible year values are 90 to 99 (1990..1999) and 0 to 53 (2000..2053)
  const rawYear = view.getUint8(0);
  const year = rawYear >= 90 ? 1900 + rawYear : 2000 + rawYear;

  return new Date(
    year,
    view.getUint8(1) - 1, // Month (zero indexed in JavaScript)
    view.getUint8(2), // Day of month
    view.getUint8(3), // Hour
    view.getUint8(4), // Minute
    view.getUint8(5), // Seconds
    0, // Milliseconds
  );
};

/**
 * Checking that sum of all bytes in provided view modulo 256 equals controlByte.
 */
export const checkControlCode = (view: DataView, controlByte: number = 0) => {
  let sum = 0;
  for (let i = 0; i < view.byteLength; i++) {
    sum += view.getUint8(i);
  }

  return sum % 256 === controlByte;
};
