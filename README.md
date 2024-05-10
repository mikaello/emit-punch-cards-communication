# emit-punch-cards-communication

Utils for communication with EMIT punch card devices. These utils are
implemented wih TypeScript and based on
[streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). To
communicate with the 250 and MTR4 device, the
[Serial API](https://wicg.github.io/serial/) (see also
[Serial API on Github](https://github.com/WICG/serial) or
[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Serial)) is used, while
for the eScan device
[WebUSB API](https://developer.mozilla.org/en-US/docs/Web/API/WebUSB_API) was
needed.

NB: The Serial API currently only works in Chrome and Edge, while WebUSB API
does also work on Chrome for Android.

## Install

This library is published to NPM as ES modules (no CommonJS/IIFE):

```shell
yarn add @mikaello/emit-punch-card-communication
```

## Usage

See [example](./example) project to see how this library could be used,
especially [helper.ts](./example/helper.ts).

## Status

- :x: eScan2 device
- :white_check_mark: eScan device
- :x: ECU1
- :white_check_mark: 250 device
- :white_check_mark: MTR4 device
- :x: ePost
