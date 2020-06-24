require("yargs")
  .command(require("./agents/bot").default)
  .command(require("./agents/bench").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;
