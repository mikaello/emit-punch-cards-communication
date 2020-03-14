# Demo - communication with 250 and MTR4 device

Transpile code and start server:

```shell
yarn install
yarn start
```

You can now open [http://localhost:8090](http://localhost:8090) and start
testing your local 250 or MTR4 device.

To continuously watch files for changes, you need to start Gulp (in another tab):

```shell
yarn dev
```

When `yarn dev` is ran, Gulp will start and you can change code in both this _example_ folder and the in the library (one
up (`../src/*.ts`)). Gulp is watching changes for all TS-files, and will start the correct task according to
which file is changed. The server will automatically reload when files are changed.
