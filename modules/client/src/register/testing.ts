const _Mocha = require('mocha')

const oldRun = _Mocha.prototype.run
_Mocha.prototype.run = function(fn: any) {
  this.suite.on('pre-require', function(context: any, file: any, mocha: any) {
    context.describe.only = (name: string) => {
      throw new Error(`Don't use 'describe.only'! Instead, run tests with "--grep '${name}'"`)
    }
  })
  return oldRun.call(this, fn)
}
