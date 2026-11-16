/** Read-only eScan2 commands. Each command is slash-prefixed and CRLF-terminated. */
const encode = (command: string) => new TextEncoder().encode(`/${command}\r\n`);

const positiveInteger = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("Expected a positive integer");
  }
  return value;
};

export const getStatusCommand = () => encode("ST");
export const getTodayCommand = () => encode("QM");
export const getAllCommand = () => encode("QD");
export const getMessageCommand = (number: number) =>
  encode(`QC${positiveInteger(number)}`);
export const getMessagesFromCommand = (number: number) =>
  encode(`QF${positiveInteger(number)}`);
export const getTagCommand = (tagNumber: number) =>
  encode(`QT${positiveInteger(tagNumber)}`);
export const getStopCommand = () => encode("QS");
