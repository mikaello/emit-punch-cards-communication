# Demo communication with 250 device

Transpile code and start server:

```shell
yarn install
yarn start
```

You can now open [http://localhost:8090](http://localhost:8090) and start
testing your local 250 device.

To continously watch files for changes, you need to start gulp (in another tab):

```shell
yarn dev
```

When `yarn dev` is run you can change code in both this folder and the folder on
up (`../*.ts`). The server will automatically reload when gulp detects changes.
