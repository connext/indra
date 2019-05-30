/*
 * A common entrypoint for all components.
 * Does some minimal environment configuration.
 */

/* tslint:disable */

// @ts-ignore
global.fetch = require('fetch-ponyfill')().fetch

// @ts-ignore
global.Promise = require('bluebird')

// Long stack is nice but incurs a 4-5x performance penalty
// @ts-ignore
Promise.longStackTraces()

// Enable more verbose debug logging outside of production
if (process.env.NODE_ENV != 'production') {
  let debug = require('debug')
  debug.enable([
    '-nodemon',
    '-express:application',
    '-sequelize:hooks',
    '-express:router*',
    '-socket.io:namespace',
    '-nock.*',
    '-mocha:*',
    '-sequelize:sql:pg',
    '-sequelize:connection:pg',
    '-follow-redirects',
    '-connect:redis',
    '-express-session',
  ].join(','))
}

