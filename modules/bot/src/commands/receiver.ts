import { EventNames, EventPayloads, ConditionalTransferTypes, PublicParams } from "@connext/types";
import {
  ColorfulLogger,
  stringify,
  ChannelSigner,
  getTestVerifyingContract,
  getTestReceiptToSign,
} from "@connext/utils";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";
import { Argv } from "yargs";

import { createClient } from "../helpers/client";

export default {
  command: "receiver",
  describe: "Start the receiver service",
  builder: (yargs: Argv) => {
    return yargs
      .option("concurrency-index", {
        description: "Number that identifies this bot when many are running in parallel",
        type: "string",
        default: "1",
      })
      .option("log-level", {
        description: "0 = print no logs, 5 = print all logs",
        type: "number",
        default: 2,
      })
      .option("name", {
        description: "Client namespace",
        type: "string",
        default: "client",
      })
      .option("payment-limit", {
        description: "Exit after receiving this number of payments (defaults to -1 for no limit)",
        type: "number",
        default: -1,
      })
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = "Receiver";
    const TRANSFER_AMT = parseEther("0.01");
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    const log = new ColorfulLogger(NAME, 3, true, argv.concurrencyIndex);
    log.info(JSON.stringify(argv));

    const client = await createClient(
      argv.privateKey,
      NAME,
      log,
      TRANSFER_AMT,
      nodeUrl!,
      ethUrl!,
      messagingUrl!,
      argv.logLevel,
    );

    let paymentCount = 0;
    client.on(
      EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT,
      async (eventData: EventPayloads.SignedTransferCreated) => {
        // ignore transfers from self
        if (eventData.sender === client.publicIdentifier) {
          return;
        }

        log.info(`Received transfer ${paymentCount}: ${stringify(eventData)}`);

        if (eventData.type !== ConditionalTransferTypes.SignedTransfer) {
          log.error(`Receiver unexpected transfer type: ${eventData.type}`);
          return;
        }

        log.info(`Unlocking transfer...`);

        if (client.signerAddress !== eventData.transferMeta.signer) {
          log.error(
            `Transfer's specified signer ${eventData.transferMeta.signer} does not match our signer ${client.signerAddress}`,
          );
          return;
        }
        const signer = new ChannelSigner(argv.privateKey, ethUrl);
        const verifyingContract = getTestVerifyingContract();
        const receipt = getTestReceiptToSign();
        const signature = await signer.signReceipt(receipt, verifyingContract);
        const attestation = {
          ...receipt,
          signature,
        };
        await client.resolveCondition({
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId: eventData.paymentId,
          attestation,
        } as PublicParams.ResolveSignedTransfer);

        log.info(`Unlocked transfer ${eventData.paymentId} for (${eventData.amount} ETH)`);

        if (!eventData.sender) {
          log.error(`Sender not specified, cannot send transfer back`);
          return;
        }

        log.info(`Send ${eventData.amount} ETH back to ${eventData.sender}`);
        let response = await client.transfer({
          amount: eventData.amount,
          recipient: eventData.sender,
          assetId: AddressZero,
        });
        log.info(
          `${eventData.amount} ETH sent back to ${eventData.sender} via transfer ${response.paymentId}`,
        );

        paymentCount += 1;
        if (argv.paymentLimit >= 0 && paymentCount > argv.paymentLimit) {
          log.info(`Received last payment before exceeding limit`);
          process.exit(0);
        } else if (argv.paymentLimit >= 0) {
          log.info(`${argv.paymentLimit - paymentCount} payments to go`);
        }
      },
    );

    log.info(`Ready to receive transfer`);
  },
};
