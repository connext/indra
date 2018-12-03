#!/usr/bin/env node

let ejs = require('ejs')

if (process.argv.length < 3 || /^(-h|--help)/.exec(process.argv[2])) {
  console.log(`USAGE: ${process.argv[1]} INPUT_FILE`)
  process.exit(1)
}

ejs.renderFile(process.argv[2], {}, { escape: x => x }, (err, str) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }

  process.stdout.write(str)
})
