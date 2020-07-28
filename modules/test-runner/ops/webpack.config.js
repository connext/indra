const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "development",
  target: "node",

  entry: path.join(__dirname, "../src/index.ts"),

  externals: {
    "pg-native": "commonjs2 pg-native",
    "sqlite3": "commonjs2 sqlite3",
  },

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
    path: path.join(__dirname, "../dist"),
    filename: `tests.bundle.js`,
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

  plugins: [
    new webpack.DefinePlugin({
      window: {},
    }),
  ],
};
