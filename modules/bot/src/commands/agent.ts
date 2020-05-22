import { EventNames, EventPayloads, ConditionalTransferTypes, PublicParams } from "@connext/types";
import {
  ColorfulLogger,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  getPublicIdentifierFromPublicKey,
  getPublicKeyError,
  getPublicIdentifierError,
  stringify,
} from "@connext/utils";
import { utils } from "ethers";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";
import { Argv } from "yargs";

import { createClient } from "../helpers/client";

export default {
  command: "agent",
  describe: "Start the agent",
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
      .option("interval", {
        describe: "The time interval between consecutive payments from this agent (in ms)",
        type: "number",
        default: 1000
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = "Agent";
    const TRANSFER_AMT = parseEther("0.001");
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    const log = new ColorfulLogger(NAME, 1, true, argv.concurrencyIndex);
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


    let receiverIdentifier =
      argv.receiverIdentifier || (
        argv.receiverPublicKey ? getPublicIdentifierFromPublicKey(argv.receiverPublicKey) : null
      );

    if (!receiverIdentifier) {
      log.warn(`No receiver identifier or public key was provided, returning`);
      return;
    }

    // Register sender listeners to send a new payment once prev one finishes
    let paymentCount = 0;
    client.on(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      async (eventData: EventPayloads.LinkedTransferUnlocked) => {

        // ignore transfers from self
        if (eventData.sender === client.publicIdentifier) {
          return;
        }

        paymentCount += 1;
        if (argv.paymentLimit >= 0 && paymentCount > argv.paymentLimit) {
          log.info(`We've passed the payment limit, exiting successfully`);
          process.exit(0);
        } else if (argv.paymentLimit >= 0) {
          log.info(`${argv.paymentLimit - paymentCount} payments to go`);
        }

        log.info(`Received transfer ${paymentCount}: ${stringify(eventData)}`);

        if (!eventData.sender) {
          log.error(`Sender not specified, cannot send payment back`);
          return;
        }

        const paymentId = getRandomBytes32();
        const senderSigner = getSignerAddressFromPublicIdentifier(eventData.sender);

        log.info(
          `Send signed transfer ${paymentId} for ${utils.formatEther(TRANSFER_AMT)} ETH to ${
            eventData.sender
          } (signer: ${senderSigner})`,
        );

        await client.conditionalTransfer({
          paymentId,
          amount: TRANSFER_AMT,
          conditionType: ConditionalTransferTypes.SignedTransfer,
          signer: senderSigner,
          recipient: eventData.sender,
          assetId: AddressZero,
          meta: { info: "Response payment" },
        } as PublicParams.SignedTransfer);
      },
    );

    const receiverSigner = getSignerAddressFromPublicIdentifier(receiverIdentifier);
    const paymentId = getRandomBytes32();
    log.info(
      `Send conditional transfer ${paymentId} for ${utils.formatEther(TRANSFER_AMT)} ETH to ${
        receiverIdentifier
      } (${receiverSigner})`,
    );

    await client.conditionalTransfer({
      paymentId,
      amount: TRANSFER_AMT,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      signer: receiverSigner,
      assetId: AddressZero,
      recipient: receiverIdentifier,
      meta: { info: "Bootstrap payment" },
    });

    log.info(`Conditional transfer ${paymentId} sent`);
  },
};
