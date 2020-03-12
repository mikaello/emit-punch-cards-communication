import { int32ToBytes } from "./byteHandlingUtils.js";

/**
 * `/ST`, Status. Will make the MTR send a status-message (see status message for
 * protocol description)
 */
export const getStatusCommand = () => {
  return new Uint8Array([47, 83, 84]); // /ST
};

/**
 * `/SA`. Spool all data in MTR2. No Polling will be done! This will send messages of
 *  type MTR message until all stored e-card readings are sent.
 */
export const getSpoolAllCommand = () => {
  return new Uint8Array([47, 83, 65]); // /SA
};

/**
 * `/SBxxxx`, Spool Binary. Spool all data from package# xxxx (LSB) and to on (data will be sent as MTR messages). You will need to perform a /ST to get valid to package#-s (xxxx) to use.
 */
export const getSpoolBinaryCommand = (packageNumber: number) => {
  let sb = new Uint8Array([47, 83, 66]); // /SB
  let packageNr = new Uint8Array(int32ToBytes(packageNumber));

  let command = new Uint8Array(7);
  command.set(sb, 0); // /SB
  command.set(packageNr, 3);

  return command;
};

/**
 * `/NS`, New session. Issuing this command will start a new session.
 */
export const getNewSessionCommand = () => {
  return new Uint8Array([47, 78, 83]); // /NS
};

/**
 * `/GBxxxx`, Get message binary. Will send a single data-message from history
 * in the format of a MTR message. The MTR will continue "polling" for e-cards
 * during data sending, with short dealy for receipt. Least significant byte
 * first. Use {@link getStatusCommand}  to find the xxxx you are looking for.
 */
export const getMessageBinaryCommand = (packageNumber: number) => {
  let gb = new Uint8Array([47, 71, 66]); // /GB
  let packageNr = new Uint8Array(int32ToBytes(packageNumber));

  let command = new Uint8Array(7);
  command.set(gb, 0); // /SB
  command.set(packageNr, 3);

  return command;
};

/**
 * `/SCymdhms`, Set clock on MTR4 to the given date.
 * @param date date can be a Date object or milliseconds since epoch
 */
export const getSetClockCommand = (date: Date | number) => {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  let sc = new Uint8Array([47, 83, 67]); // /SC
  let clock = new Uint8Array([
    Number((date.getFullYear() + "").substring(2)), // only two last digits
    date.getMonth() + 1, // 1 indexed in command
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ]);

  let command = new Uint8Array(9);
  command.set(sc, 0);
  command.set(clock, sc.length);

  return command;
};

/**
 * `/CL`, Clear Ringbuffer. Will clear all history (and reset package counters!).
 */
export const getClearRingbufferCommand = () => {
  return new Uint8Array([47, 67, 76]); // /CL
};
