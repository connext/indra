// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

////////////////////////////////////////
// To exit tests after first failure, the following code was copy/pasted from:
// https://github.com/cypress-io/cypress/issues/518#issuecomment-552382781

let shouldSkip = false;
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  // on('task', { failed: require('cypress-failed-log/src/failed')(), })
  on("task", {
    resetShouldSkipFlag() {
      shouldSkip = false;
      return null;
    },
    shouldSkip(value) {
      if (value != null) shouldSkip = value;
      return shouldSkip;
    },
  });
};
////////////////////////////////////////
