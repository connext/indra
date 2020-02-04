const path = require('path');
const nodeExternals = require('webpack-node-externals');

const mode = process.env.MODE === "release" ? "release" : "staging";
const whitelist = mode === "release" ? '' : /@connext\/.*/;

console.log(`Building ${mode}-mode bundle`);

module.exports = {
  mode: "development",
  target: 'node',
  externals: [nodeExternals({
    modulesDir: path.resolve(__dirname, '../../../node_modules'),
    whitelist,
  })],

  resolve: {
    extensions: ['.js', '.ts', '.json'],
    symlinks: false
  },

  entry: {
    tests: path.join(__dirname, '../src/index.ts'),
    setup: path.join(__dirname, '../src/setup.ts'),
    flamegraph: path.join(__dirname, '../src/benchmarking/flamegraph.ts')
  },

  output: {
    path: path.join(__dirname, '../dist'),
    filename: `[name].bundle.js`,
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/env'],
          },
        },
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.join(__dirname, '../tsconfig.json')
          },
        },
      },
    ],
  },
};
