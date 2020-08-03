import * as evm from "@connext/pure-evm-wasm";
import { HexString } from "@connext/types";

// We might need to convert this file to JS...
// https://github.com/rustwasm/wasm-bindgen/issues/700#issuecomment-419708471

export const execEvmBytecode = (bytecode: HexString, payload: HexString): Uint8Array =>
  evm.exec(
    Uint8Array.from(Buffer.from(bytecode.replace(/^0x/, ""), "hex")),
    Uint8Array.from(Buffer.from(payload.replace(/^0x/, ""), "hex")),
  );
