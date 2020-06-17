const path = require("path");
const nodeExternals = require("webpack-node-externals");

const mode = process.env.MODE === "release" ? "release" : "staging";
const whitelist = mode === "release" ? "" : /@connext\/[^p].*/;
console.log(`Building ${mode}-mode bundle`);

module.exports = {
  mode: "development",
  target: "node",

  context: path.join(__dirname, ".."),

  entry: path.join(__dirname, "../src/main.ts"),

  externals: [
    nodeExternals({
      modulesDir: path.join(__dirname, "../../../node_modules"),
      whitelist,
    }),
  ],

  node: {
    __filename: true,
    __dirname: true,
  },

  resolve: {
    mainFields: ["main", "module"],
    extensions: [".js", ".wasm", ".ts", ".json"],
    symlinks: false,
  },

  output: {
    path: path.join(__dirname, "../dist/src"),
    filename: "main.js",
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/env"],
          },
        },
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.join(__dirname, "../tsconfig.json"),
          },
        },
      },
      {
        test: /\.wasm$/,
        type: "javascript/auto",
        loaders: ["wasm-loader"],
      },
    ],
  },
};
