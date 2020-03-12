# 250 protocol description

### Type

Regnly EPT system, data from 250 reader with FTDI chip.

### Communication settings:

RS232, baude 9600, no parity, 8 bit, 2 stop bit.

| Byte    | Description                                                                                          | Format                       | Value | Number of bytes |
| ------- | ---------------------------------------------------------------------------------------------------- | ---------------------------- | ----- | --------------- |
| 1       | package start                                                                                        | Identification               | 0xFF  | 1               |
| 2       | cont.                                                                                                |                              | 0xFF  | 1               |
| 3       | e-card no.                                                                                           | LSB Binary code (max 999999) |       | 1               |
| 4       | cont.                                                                                                |                              |       | 1               |
| 5       | cont.                                                                                                |                              |       | 1               |
| 6       | not used                                                                                             |                              | 0x00  | 1               |
| 7       | Production week                                                                                      | Binary 1-53                  |       | 1               |
| 8       | Production year                                                                                      | Binary 94-xx                 |       | 1               |
| 9       | not used                                                                                             |                              | 0x00  | 1               |
| 10      | check byte e-card no. Addition of bytes 3-10 mod 256 == 0                                            |                              |       | 1               |
| 11-160  | Control codes and times. 50 x (1 byte binary control code 0-250 and 2 bytes binary time 0-65534 sec) |                              |       | 150             |
| 161-168 | ASCII string, Emit time system/runners name                                                          |                              |       | 8               |
| 169-176 | cont.                                                                                                |                              |       | 8               |
| 177-184 | cont.                                                                                                |                              |       | 8               |
| 185-192 | cont.                                                                                                |                              |       | 8               |
| 193-200 | ASCII string, disp 1                                                                                 |                              |       | 8               |
| 201-208 | ASCII string, disp 2                                                                                 |                              |       | 8               |
| 209-216 | ASCII string, disp 3                                                                                 |                              |       | 8               |
| 217     | check byte. Addition of all bytes 1-217 mod 256 == 0                                                 |                              |       | 1               |
|         |                                                                                                      |                              |       |                 |
|         | **SUM**                                                                                              |                              |       | **217**         |

All bytes must be XOR-ed with OD (255 - 32).

Disp 2-3 is now used for counters:

- Disp 2: S0000P00
- Disp 3: 00L00000

Description of format:

<dl>
  <dt>S0000</dt>
  <dd>The S-field indicates the number of disturbances/noise that woke up the e-card but was not recognized the signal</dd>

  <dt>P0000</dt>
  <dd>The P-field indicates the number of "tests/readings". A test is when e-card is made put to sleep by MTR or 250-control within approx 4 minutes from beeing waken-up.</dd>

  <dt>L00000</dt>
  <dd>The L-field indicates the number of events when e-card was awake for more than approx 4 min.</dd>
</dl>

Emit as 11.2.94
