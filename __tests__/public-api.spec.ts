import { escanCommands, mtr4Commands, OdTransformStream } from "../src";

test("command modules and OD transform are available from the public entrypoint", () => {
  expect(escanCommands.createUSBCommand(escanCommands.USBCommand.ST)).toEqual(
    new Uint8Array([47, 83, 84, 13, 10]),
  );
  expect(mtr4Commands.getStatusCommand()).toEqual(new Uint8Array([47, 83, 84]));
  expect(new OdTransformStream()).toBeInstanceOf(TransformStream);
});
