const NodeJSEnvironment = require("jest-environment-node");

require("dotenv-extended").load();

// This environment runs for _every test suite_.

class NodeEnvironment extends NodeJSEnvironment {
  constructor(config) {
    super(config);
  }

  async setup() {
    await super.setup();
    this.global.fundedPrivateKey = global["fundedPrivateKey"];
    this.global.ganacheURL = global["ganacheUrl"];
    this.global.networkContext = global["networkContext"];
  }

  async teardown() {
    await super.teardown();
  }

  runScript(script) {
    return super.runScript(script);
  }
}

module.exports = NodeEnvironment;
