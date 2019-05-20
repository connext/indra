/* tslint:disable */
const _Mocha = require('mocha')

// @ts-ignore
global.fetch = require('node-fetch-polyfill')

const oldRun = _Mocha.prototype.run
_Mocha.prototype.run = function(fn: any): any {
  this.suite.on('pre-require', (context: any, file: any, mocha: any): any => {
    context.describe.only = (name: string): any => {
      throw new Error(`Don't use 'describe.only'! Instead, run tests with "--grep '${name}'"`)
    }
  })
  return oldRun.call(this, fn)
}
