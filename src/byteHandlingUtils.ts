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
 * Checking that sum of all bytes in provided view modulo 256 equals 0.
 */
export const checkControlCode = (view: DataView) => {
  let sum = 0;
  for (let i = 0; i < view.byteLength; i++) {
    sum += view.getUint8(i);
  }

  return sum % 256 === 0;
};
