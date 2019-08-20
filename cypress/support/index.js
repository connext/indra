// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
import './commands'
chai.use(require('chai-bn')(require('bn.js')))

// store logs
let logs = '';

Cypress.on('window:before:load', (window) => {
    // Overwrite all of the console methods.
    ['log', 'info', 'error', 'warn', 'debug'].forEach((consoleProperty) => {
      const oldConsole = window.console[consoleProperty]
      window.console[consoleProperty] = function (...args) {
         oldConsole(...args) // Still console log everything
         logs += args.join(' ') + '\n'; // Also save copy of all logs to dump if tests fail
       };
    });
});

// Cypress doesn't have a each test event
// so I'm using mochas events to clear log state after every test.
Cypress.mocha.getRunner().on('test', () => {
    // Every test reset your logs to be empty
    // This will make sure only logs from that test suite will be logged if a error happens
    logs = '';
});

// On a cypress fail. I add the console logs, from the start of test or after the last test fail to the
// current fail, to the end of the error.stack property.
Cypress.on('fail', (error) => {
    error.stack += '\nConsole Logs:\n========================';
    error.stack += logs;
    // clear logs after fail so we dont see duplicate logs
    logs = '';
    // still need to throw the error so tests wont be marked as a pass
    throw error;
});
