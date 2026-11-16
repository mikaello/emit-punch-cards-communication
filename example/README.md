# Device example

This browser example uses the local package through `file:..`.
Build the library before starting the example so it loads the current `dist` output.
See [helper.ts](./helper.ts) for the 250, MTR4, eScan, and eScan2 connection and parsing code.
The [Web Serial types](./serial-types.ts) link to the relevant parts of the specification.

From the repository root:

```sh
npm ci
npm run build
npm --prefix example ci
npm --prefix example start
```

Open the localhost address printed by Vite in a browser with Web Serial and WebUSB support.
Use the 250, MTR4, eScan, or eScan2 buttons to connect a device and inspect card readings and status messages.
For eScan2, choose its virtual COM port in the Web Serial picker; its USB vendor and product IDs are not assumed.
The eScan2 controls can request today's stored readings, all stored readings, or stop a spool without clearing device memory.
The eScan2 decoder handles the documented output formats and reports checksum validity, but it has not yet been checked against a physical device or firmware version.
After changing the library source, run `npm run build` again and reload the page.
For continuous builds, run `npm run build -- --watch` in another terminal.

The example build can verify that the browser can bundle the package without a device:

```sh
npm --prefix example run build
```
