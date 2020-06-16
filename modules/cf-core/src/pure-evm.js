
// Why is this file js instead of ts? See:
// https://github.com/rustwasm/wasm-bindgen/issues/700#issuecomment-419708471

module.exports.execEvmBytecode = (bytecode, payload) => {
  return Promise.resolve().then(
    () => _interopRequireWildcard(require("@connext/pure-evm-wasm")),
  ).then(
    evm => evm.exec(
      Uint8Array.from(Buffer.from(bytecode.replace(/^0x/, ""), "hex")),
      Uint8Array.from(Buffer.from(payload.replace(/^0x/, ""), "hex")),
    ),
  );
};

// This is copy/pasted babel output that transpiles:
// `import("module").then(...)

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  }
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
    return {
      default: obj,
    };
  }
  const newObj = {};
  const hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc);
      } else {
        newObj[key] = obj[key];
      }
    }
  }
  newObj.default = obj;
  return newObj;
}
