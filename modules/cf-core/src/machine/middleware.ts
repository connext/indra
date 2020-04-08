import { GenericMiddleware, Opcode } from "@connext/types";

export class MiddlewareContainer {
  public readonly middlewares: { [I in Opcode]: GenericMiddleware[] } = {
    [Opcode.IO_SEND]: [],
    [Opcode.IO_SEND_AND_WAIT]: [],
    [Opcode.OP_SIGN]: [],
    [Opcode.PERSIST_APP_INSTANCE]: [],
    [Opcode.PERSIST_COMMITMENT]: [],
    [Opcode.PERSIST_STATE_CHANNEL]: [],
    [Opcode.OP_VALIDATE]: [],
  };

  public add(scope: Opcode, method: GenericMiddleware) {
    this.middlewares[scope].push(method);
  }

  public async run(opCode: Opcode, args: any[]) {
    const middleware = this.middlewares[opCode][0];

    // it is okay for middleware to be undefined iff
    // it is the validation opcode
    if (typeof middleware === "undefined") {
      if (opCode !== Opcode.OP_VALIDATE) {
        throw new Error(`Attempted to run middleware for opcode ${opCode} but none existed`);
      }
      return;
    }

    return middleware(args);
  }
}
