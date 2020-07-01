require("yargs")
  .command(require("./agents/bot").default)
  .command(require("./farm").command)
  .command(require("./agents/bench").default)
  .demandCommand(1, "Choose a command from the above list")
  .help().argv;

// This CLI should exit if any unhandled rejections slip through.
process.on("unhandledRejection", (e: any) => {
  console.error(`UnhandledPromiseRejection: ${e?.body?.error?.message || e?.message || e}`);
  process.exit(1);
});
