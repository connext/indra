const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: "development",
  target: 'node',
  externals: {
    eccrypto: 'commonjs eccrypto'
  },

  resolve: {
    extensions: [ '.js', '.ts', '.json' ],
    symlinks: false
  },

  entry: path.join(__dirname, '../src/index.ts'),

  output: {
    path: path.join(__dirname, '../dist'),
    filename: 'index.js',
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

  plugins: [
    // new webpack.IgnorePlugin({ resourceRegExp: /eccrypto/ })
  ]
  // stats: { warnings: false, },
};
