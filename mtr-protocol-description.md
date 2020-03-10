# MTR protocol description

baude 9600, no parity, 8 bit, 1 stop bit.

## Input commands to MTR

<dl>
  <dt><code>/ST</code></dt>
  <dd>Status. Will make the MTR send a status-message (see <a href="#status-message">status message</a> for protocol description)</dd>

  <dt><code>/SA</code></dt>
  <dd>Spool all data in MTR2. No Polling will be done! This will send messages of type <a href="#message-description">MTR message</a> until all stored e-card readings are sent.</dd>

  <dt><code>/SBxxxx</code></dt>
  <dd>Spool Binary. Spool all data from package# xxxx (LSB) and to on (data will be sent as <a href="#message-description">MTR messages</a>). You will need to perform a <code>/ST</code> to get valid to package#-s (<code>xxxx</code>) to use.</dd>

  <dt><code>/NS</code></dt>
  <dd>New session</dd>

  <dt><code>/GBxxxx</code></dt>
  <dd>Get message binary. Will send a single data-message from history in the format of a <a href="#message-description">MTR message</a>. The MTR will continue "polling" for e-cards during data sending, with short dealy for receipt. Least significant byte first. Use <code>/ST</code> to find the <code>xxxx</code> you are looking for.</dd>

  <dt><code>/SCymdhms</code></dt>
  <dd>Set clock. The 6 bytes are binary values for current time:

  <dl>
  <dt>y</dt>
  <dd>year: values accepted are 90 to 99 (1990..1999) and 0 to 53 (2000..2053) </dd>

  <dt>m</dt>
  <dd>month: values accepted are 1 to 12</dd>

  <dt>d</dt>
  <dd>daynumber: values accepted are 1 to 31</dd>

  <dt>h</dt>
  <dd>hour: values accepted are 0 to 23</dd>

  <dt>m</dt>
  <dd>minute: values accepted are 0 59</dd>

  <dt>s</dt>
  <dd>second: values accepted are 0 59</dd>
  </dl>
  </dd>

  <dt><code>/CL</code></dt>
  <dd>Clear Ringbuffer. Will clear all history (and reset package counters!)</dd>

</dl>

## Message description

An MTR message is an e-card reading (either by user placing ecard on MTR, or by
issuing a command to MTR to retrieve from history), and have the following
format:

| Byte    | Name            | Description                                                                                                                              | Value        | Number of bytes |
| ------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------- |
| 1-4     | preamble        | (4 0xFF never occur "inside" a message, this can be used to resynchronize logic if a connection is broken)                               | 0xFF         | 4               |
| 5       | package-size    | number of bytes excluding `preamble` ( = 230)                                                                                            | 0xE6         | 1               |
| 6       | package-type    | 'M' as "MTR-datamessage".                                                                                                                | 0x4D         | 1               |
| 7-8     | MTR-id          | Serial number of MTR2; Least significant byte first                                                                                      |              | 2               |
| 9-14    | timestamp       | Binary Year, Month, Day, Hour, Minute, Second                                                                                            |              | 6               |
| 15-16   | TS milliseconds | Milliseconds NOT YET USED, WILL BE 0 IN THIS VERSION.                                                                                    |              | 2               |
| 17-20   | package no.     | Binary Counter, from 1 and up; Least significant byte first                                                                              |              | 4               |
| 21-23   | e-card no.      | Binary, Least significant byte first                                                                                                     |              | 3               |
| 24      | Production week | 0-53 (0 when package is retrived from "history", e.g. when spooling)                                                                     |              | 1               |
| 25      | Production year | 94-99,0-..X (0 when package is retrived from "history", e.g. when spooling)                                                              |              | 1               |
| 26      | e-card head sum | head check sum <TODO: how to calculate?> (value 0 when package is retrived from "history", e.g. when spooling)                           | 0x00 or 0x01 | 1               |
| 27-176  | control-codes   | Control codes and times. 50 x (1 byte binary control code 0-250 and 2 bytes binary time 0-65534 sec). Unused controls and times are `0`. |              | 150             |
| 177-232 | ASCII-string    | Various info depending on e-card-type. 20h when retrived from "history" (see [ASCII-string](#ascii-string-in-mtr-message))               |              | 56              |
| 233     | Checksum        | Binary SUM (MOD 256) of all bytes including `preamble`                                                                                   |              | 1               |
| 234     | NULL-filler     | Binary 0 (to avoid potential 5 0xFF's. Making it easier to haunt `preamble`                                                              | 0x00         | 1               |
|         |                 |                                                                                                                                          |              |                 |
|         |                 | **SUM**                                                                                                                                  |              | **234**         |

All bytes must be XOR-ed with OD (255 - 32).

## Status message

A status message message is the response for a `/ST` command to the MTR, it has
the following format:

| Byte  | Name                 | Description                                                                                                                       | Value        | Number of bytes |
| ----- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------- |
| 1-4   | preamble             | (4 times 0xFF never occur "inside" a message, this can be used to resynchronize logic if a connection is broken)                  | 0xFF         | 4               |
| 5     | package-size         | number of bytes excluding preamble ( = 55)                                                                                        | 0x37         | 1               |
| 6     | package-type         | 'S' as "Status-message".                                                                                                          | 0x53         | 1               |
| 7-8   | MTR-id               | Serial number of MTR; Least significant byte first                                                                                |              | 2               |
| 9-14  | CurrentTime          | Binary Year, Month, Day, Hour, Minute, Second                                                                                     |              | 6               |
| 15-16 | CurrentMilliseconds  | Milliseconds NOT YET USED, WILL BE 0 IN THIS VERSION.                                                                             |              | 2               |
| 17    | BatteryStatus        | 1 if battery low, 0 if battery OK.                                                                                                | 0x00 or 0x01 | 1               |
| 18-21 | RecentPackage#       | if this is 0, then ALL the following `[name]#` should be ignored                                                                  |              | 4               |
| 22-25 | OldestPackage#       | note: If `RecentPackage# == 0` then this is still 1! meaning: number and packages in MTR is `RecentPackage# - OldestPackage# + 1` |              | 4               |
| 26-29 | CurrentSessionStart# | Current session is from here to `RecentPackage#` (if NOT = 0)                                                                     |              | 4               |
| 30-33 | Prev1SessStart#      | Prev session was from `Prev1SessStart#` to `CurrentSessionStart# - 1`                                                             |              | 4               |
| 34-37 | Prev2SessStart#      |                                                                                                                                   |              | 4               |
| 38-41 | Prev3SessStart#      |                                                                                                                                   |              | 4               |
| 42-45 | Prev4SessStart#      |                                                                                                                                   |              | 4               |
| 46-47 | Prev5SessStart#      |                                                                                                                                   |              | 4               |
| 48-51 | Prev6SessStart#      |                                                                                                                                   |              | 4               |
| 54-57 | Prev7SessStart#      |                                                                                                                                   |              | 4               |
| 58    | Checksum             | Binary SUM (MOD 256) of all bytes including `preamble`                                                                            |              | 1               |
| 59    | NULL-filler          | Binary 0 (to avoid potential 5 0xFF's. Making it easier to haunt `preamble`                                                       | 0x00         | 1               |
|       |                      |                                                                                                                                   |              |                 |
|       |                      | **SUM**                                                                                                                           |              | **234**         |

NB: All names ending with `#` denotes a number with the least signicant byte
first. This number is meant to be used with the `/SBxxxx` and `/GBxxxx` commands
to the MTR.

## ASCII-string in MTR message

The 56 ASCII bytes sent from e-card will have the following info (only in
on-line mode! Offline all blank!).

NOTE: This ASCII string i reprogrammable, so no assumption should be made that
the following data will remain correct for future versions of e-cards.

### New e-cards (manufactured after summer 1998 with green/amber casing)

Example: `"EMIT EPT SYS VER 2 DISP-1 S0059P0136L0004 "`

<dl>
  <dt>S0000</dt>
  <dd>The S-field indicates the number of disturbances/noise that woke up the e-card but was not recognized the signal</dd>

  <dt>P0000</dt>
  <dd>The P-field indicates the number of "tests/readings". A test is when e-card is made put to sleep by MTR or 250-control within approx 4 minutes from beeing waken-up.</dd>

  <dt>L00000</dt>
  <dd>The L-field indicates the number of events when e-card was awake for more than approx 4 min.</dd>
</dl>

### Old e-cards (yellow)

Example: `"REGNLY TRACK RECORDING SYSTEM DISP-1 DISP-2 DISP-3 "`
