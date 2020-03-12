/**
 * Status message from an MTR4 device, response of a `/ST` write.
 *
 * Message: 59 bytes.
 */
export const mtr4StatusMessage = new Uint8Array([
  255, // Preamble: four 0xff
  255,
  255,
  255,
  55, // Package-size: number of bytes excluding preamble, (0x37)
  83, // Package-type: 'S' as "Status-message" (0x53)
  129, // MTR-id: Serial number of MTR2. 2 bytes
  55,
  19, // CurrentTime: Binary Year, Month, Day, Hour, Minute, Second. 6 bytes
  12,
  8,
  19,
  51,
  53,
  0, // CurrentMilliseconds. 2 bytes.
  0,
  0, // BatteryStatus: 1 if battery low. 0 if battery OK
  193, // RecentPackage: 4 bytes
  167,
  223,
  247,
  67, // OldestPackage: 4 bytes
  0,
  0,
  0,
  187, // CurrentSessionStart: Current session is from here to RecentPacage (if NOT = 0). 4 bytes
  167,
  223,
  247,
  184, // Prev1SessStart: 4 bytes.
  167,
  223,
  247,
  81, // Prev2SessStart
  167,
  223,
  247,
  79, // Prev3SessStart
  167,
  223,
  247,
  78, // Prev4SessStart
  167,
  223,
  247,
  200, // Prev5SessStart
  166,
  223,
  247,
  195, // Prev6SessStart
  166,
  223,
  247,
  165, // Prev7SessStart
  166,
  223,
  247,
  215, // CheckSum: Binary SUM (MOD 256) of all bytes including Preamble
  0, // NULL-Filler: Binary 0 (to avoid potential 5 FF's. Making it easier to haunt PREAMBLE
]);
