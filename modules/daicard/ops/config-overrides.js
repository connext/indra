// Goal: add wasm support to a create-react-app
// Solution derived from: https://stackoverflow.com/a/61722010

const path = require("path");

module.exports = function override(config, env) {
  const wasmExtensionRegExp = /\.wasm$/;

  config.resolve.extensions.push(".wasm");

  config.module.rules.forEach(rule => {
    (rule.oneOf || []).forEach(oneOf => {
      if (oneOf.loader && oneOf.loader.indexOf("file-loader") >= 0) {
        // make file-loader ignore WASM files
        oneOf.exclude.push(wasmExtensionRegExp);
      }
    });
  });

  // add a dedicated loader for WASM
  config.module.rules.push({
    include: path.resolve(__dirname, "src"),
    test: wasmExtensionRegExp,
    type: "webassembly/experimental",
    use: [{ loader: require.resolve("wasm-loader"), options: {} }],
  });

  return config;
};
