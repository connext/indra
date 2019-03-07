const _Mocha = require('mocha')

const oldRun = _Mocha.prototype.run
_Mocha.prototype.run = function(fn) {
  this.suite.on('pre-require', function(context, file, mocha) {
    context.describe.only = (name: string) => {
      throw new Error(`Don't use 'describe.only'! Instead, run tests with "--grep '${name}'"`)
    }
  })
  return oldRun.call(this, fn)
}
