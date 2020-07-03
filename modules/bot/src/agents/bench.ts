import { connect } from "@connext/client";
import { getFileStore } from "@connext/store";
import { CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { ColorfulLogger, getSignerAddressFromPublicIdentifier } from "@connext/utils";
import { utils } from "ethers";
import { Argv } from "yargs";

import { env } from "../env";
import { externalBotRegistry } from "../helpers/agentIndex";

import { Agent } from "./agent";

const { parseEther } = utils;

export default {
  command: "bench",
  describe: "Start the benchmarker",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency-index", {
        description: "Number that identifies this agent when many are running in parallel",
        type: "string",
        default: "1",
      })
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 1,
      })
      .option("number-payments", {
        describe: "The number of payments this agent should initiate",
        type: "number",
        default: 200,
      })
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = `Bot #${argv.concurrencyIndex}`;
    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);
    log.info(`Launched bot ${NAME}`);
    const TRANSFER_AMT = parseEther("0.0001");
    const DEPOSIT_AMT = parseEther("0.01"); // Note: max amount in signer address is 1 eth

    const client = await connect({
      ...env,
      signer: argv.privateKey,
      loggerService: new ColorfulLogger(NAME, argv.logLevel, true, argv.concurrencyIndex),
      store: getFileStore(`.connext-store/${argv.privateKey}`),
    });

    log.info(`Client ${argv.concurrencyIndex}:
        publicIdentifier: ${client.publicIdentifier}
        signer: ${client.signerAddress}
        nodeIdentifier: ${client.nodeIdentifier}
        nodeSignerAddress: ${client.nodeSignerAddress}`);

    const agent = new Agent(log, client, argv.privateKey, true);
    log.info("Agent starting up.");
    await agent.start();
    log.info("Agent started.");

    log.info(`Registering address ${client.publicIdentifier}`);
    await externalBotRegistry.add(client.publicIdentifier);

    await agent.depositIfNeeded(TRANSFER_AMT, DEPOSIT_AMT);
    await client.requestCollateral(CONVENTION_FOR_ETH_ASSET_ID);

    const receiverIdentifier = await externalBotRegistry.get(0);
    // the first bot should sit and unlock transactions
    if (receiverIdentifier === client.publicIdentifier) {
      return;
    }

    const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);

    for (let i = 0; i < argv.numberPayments; i++) {
      const start = Date.now();
      await agent.pay(receiverIdentifier, receiverSigner, TRANSFER_AMT);
      log.info(`Completed end-to-end payment. Elapsed: ${Date.now() - start}`);
    }
  },
};
