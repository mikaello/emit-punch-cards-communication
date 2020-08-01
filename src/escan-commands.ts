/**
 * Available commands for EMIT USB peripherals.
 *
 * TODO: fill with more data
 */
export enum USBCommand {
  /**
   * (ECU only) Set a custom text in the tag
   */
  EMITAGTS = "EMITAGTS",

  /**
   * (ECU only) Set a custom text in the tag
   */
  EMITAGCNRS = "EMITAGCNRS",

  /**
   * (ECU only) Change display mode when receiving a tag
   */
  DM = "DM",

  /**
   * (eScan only) Set eScan serial number (TODO: typo?)
   */
  SETSERIALNUMBER = "SETSERIALNUMBER",

  /**
   * Set the internal product serial number
   */
  SERIALNUMBER = "SERIALNUMBER",

  /**
   * (eScan only) set date
   */
  SD = "SD",

  /**
   * Set clock
   */
  SC = "SC",

  /**
   * (eScan only) Show red led for 1sec
   */
  RED = "RED",

  /**
   * (eScan only) Show green led for 1sec
   */
  GREEN = "GREEN",

  /**
   * Set the protocol format
   */
  PP = "PP",

  /**
   * (eScan) Set eLine code. (ECU) Set the code of the control.
   */
  CD = "CD",

  /**
   * (eScan only) Set bluetooth printer address
   */
  BTPRINTER = "BTPRINTER",

  /**
   * (eScan only) Activate bluetooth AT communication
   */
  BTATON = "BTATON",

  /**
   * (eScan only) Deactivated bluetooth AT communication
   */
  BTATOFF = "BTATOFF",

  /**
   * (eScan only) Launch AT command to bluetooth module
   */
  BTAT = "BTAT",

  /**
   * (eScan only) Equal to `BTPRINTER`
   */
  BTNAME = "BTNAME",

  /**
   * (eScan only) Delete internal flash
   */
  FCLEAR = "FCLEAR",

  /**
   * (eScan) Output status. (ECU) Check the ECU id.
   */
  ID = "ID",

  /**
   * (eScan) Equal to `FCLEAR`. (ECU) This command tells the unit to forget all dump and start collecting at message number 1 again
   */
  CL = "CL",

  /**
   * Force output status. Equal to `ID`
   */
  ST = "ST",

  /**
   * (eScan only) Debug mode, not supported
   */
  DEBUG = "DEBUG",

  /**
   * Spool all memory on printer and PC
   */
  QD = "QD",

  /**
   * (ECU only) Spool new message of the day
   */
  QM = "QM",

  /**
   * (ECU only) Spool from a specific message number
   */
  QF = "QF",

  /**
   * (ECU only) Spool a specific message number
   */
  QC = "QC",

  /**
   * (eScan only) Launch new software programming
   */
  FLASHCB = "FLASHCB",

  /**
   * (eScan only) Transfer new program in flash
   */
  UE = "UE",
}
/**
 * eScan and ECU USB devices accepts commands, but those need to start with `/`
 * and end with Windows linefeed (CR LF), this is a utility function to
 * create those commands.
 *
 * You should wait 5 ms between each byte sent to device.
 *
 * Available commands are:
 * * `EMITAGTS`: (ECU only) Set a custom text in the tag
 * * `EMITAGCNRS`: (ECU only) Set a custom text in the tag
 * * `DM`: (ECU only) Change display mode when receiving a tag
 * * `SETSERIALNUMBER`: (eScan only) Set eScan serial number (TODO: typo?)
 * * `SERIALNUMBER`: Set the internal product serial number
 * * `SD`: (eScan only) set date
 * * `SC`: Set clock
 * * `RED`: (eScan only) Show red led for 1sec
 * * `GREEN`: (eScan only) Show green led for 1sec
 * * `PP`: Set the protocol format
 * * `CD`: (eScan) Set eLine code. (ECU) Set the code of the control.
 * * `BTPRINTER`: (eScan only) Set bluetooth printer address
 * * `BTATON`: (eScan only) Activate bluetooth AT communication
 * * `BTATOFF`: (eScan only) Deactivated bluetooth AT communication
 * * `BTAT`: (eScan only) Launch AT command to bluetooth module
 * * `BTNAME`: (eScan only) Equal to `BTPRINTER`
 * * `FCLEAR`: (eScan only) Delete internal flash
 * * `ID`: (eScan) Output status. (ECU) Check the ECU id.
 * * `CL`: (eScan) Equal to `FCLEAR`. (ECU) This command tells the unit to forget all dump and start collecting at message number 1
again.
 * * `ST`: Force output status. Equal to `ID`
 * * `DEBUG`: (eScan only) Debug mode, not supported
 * * `QD`: Spool all memory on printer and PC
 * * `QM`: (ECU only) Spool new message of the day
 * * `QF`: (ECU only) Spool from a specific message number
 * * `QC`: (ECU only) Spool a specific message number
 * * `FLASHCB`: (eScan only) Launch new software programming
 * * `UE`: (eScan only) Transfer new program in flash
 *
 * @param command command to convert to valid byte command
 * @param payload some commands require a payload
 * @returns command with proper encoding
 */

export const createUSBCommand = (
  command: USBCommand,
  payload: string = "",
): Uint8Array => {
  const stringCommand = command.toString();
  const byteCommand = new Uint8Array(
    1 + stringCommand.length + payload.length + 2,
  );
  const encoder = new TextEncoder();

  byteCommand.set(encoder.encode("/" + stringCommand + payload), 0);

  // Command must end with Windows linefeed (CR LF)
  const cr = 0x0d;
  const lf = 0x0a;
  byteCommand[byteCommand.length - 2] = cr;
  byteCommand[byteCommand.length - 1] = lf;

  return byteCommand;
};

/**
 * `/SChh:mm:ss`, set clock on eScan to the given time.
 * @param date date can be a Date object or milliseconds since epoch
 */
export const getSetClockCommand = (date: Date | number) => {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return createUSBCommand(
    USBCommand.SC,
    ("" + date.getHours()).padStart(2, "0") +
      ":" +
      ("" + date.getMinutes()).padStart(2, "0") +
      ":" +
      ("" + date.getSeconds()).padStart(2, "0"),
  );
};

/**
 * `/SDdd.mm.yyyy`, set clock on eScan to the given date.
 * @param date date can be a Date object or milliseconds since epoch
 */
export const getSetDateCommand = (date: Date | number) => {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return createUSBCommand(
    USBCommand.SD,
    ("" + date.getDate()).padStart(2, "0") +
      "." +
      ("" + (date.getMonth() + 1)).padStart(2, "0") +
      "." +
      ("" + date.getFullYear()),
  );
};
