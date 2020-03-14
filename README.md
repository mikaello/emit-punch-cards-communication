# emit-punch-cards-communication
Utils for communication with EMIT punch card devices. These utils is implemented wih
TypeScript and based on
[streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API). To
communicate with the 250 and MTR4 device, the
[Serial API](https://wicg.github.io/serial/) (see also [Serial API on Github](https://github.com/WICG/serial)) is used.

NB: The Serial API currently only works in Chrome. To start using this library you need to either [start a trial](https://developers.chrome.com/origintrials/#/register_trial/2992641952387694593) for the Serial API, or enable _Experimental Web Platform features_ in [chrome://flags](chrome://flags).

## Install

This library is published to NPM as ES modules (no CommonJS/IIFE):

```shell
yarn add @mikaello/emit-punch-card-communication
```

## Usage

See [example](./example) project to see how this library could be used, especially [helper.ts](./example/helper.ts).


## Status

* :white_check_mark: 250 device
* :x: MTR4 device
* :x: ePost
