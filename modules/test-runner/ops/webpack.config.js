<<<<<<< HEAD
const path = require("path");
const nodeExternals = require("webpack-node-externals");

const mode = process.env.MODE === "release" ? "release" : "staging";
const whitelist = mode === "release" ? "" : /@connext\/.*/;
=======
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');

const mode = process.env.MODE === "release" ? "release" : "staging";
const whitelist = mode === "release" ? "" : [/@connext\/.*/, /@provide\/.*/, "ts-natsutil"];
>>>>>>> WIP test suite

console.log(`Building ${mode}-mode bundle`);

module.exports = {
  mode: "development",
<<<<<<< HEAD
  target: "node",
  externals: [
    nodeExternals({
      modulesDir: path.resolve(__dirname, "../../../node_modules"),
      whitelist,
    }),
  ],
=======
  target: 'node',
  externals: [nodeExternals({
      modulesDir: path.resolve(__dirname, "../../../node_modules"),
    whitelist,
  })],
>>>>>>> WIP test suite

  resolve: {
    extensions: [".js", ".ts", ".json"],
    symlinks: false,
  },

  entry: {
    tests: path.join(__dirname, "../src/index.ts"),
    flamegraph: path.join(__dirname, "../src/benchmarking/flamegraph.ts"),
    flamegraphPrep: path.join(__dirname, "../src/benchmarking/flamegraphPrep.ts"),
  },

  output: {
    path: path.join(__dirname, "../dist"),
    filename: `[name].bundle.js`,
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
    ],
  },

  plugins: [
    new webpack.DefinePlugin({
      window: {},
    }),
  ],
};
