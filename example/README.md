# Device example

This browser example uses the local package through `file:..`.
Build the library before starting the example so it loads the current `dist` output.

From the repository root:

```sh
npm ci
npm run build
npm --prefix example ci
npm --prefix example start
```

Open the localhost address printed by Vite in a browser with Web Serial and WebUSB support.
Use the 250, MTR4, or eScan buttons to connect a device and inspect its messages.
After changing the library source, run `npm run build` again and reload the page.
For continuous builds, run `npm run build -- --watch` in another terminal.

The example build can verify that the browser can bundle the package without a device:

```sh
npm --prefix example run build
```
