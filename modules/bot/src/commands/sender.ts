import { Argv } from "yargs";
import {
  ColorfulLogger,
  getRandomBytes32,
  getSignerAddressFromPublicIdentifier,
  stringify,
} from "@connext/utils";
import { parseEther } from "ethers/utils";
import { createClient } from "../helpers/client";
import { EventNames, EventPayloads, ConditionalTransferTypes, PublicParams } from "@connext/types";
import { utils } from "ethers";
import { AddressZero } from "ethers/constants";

export default {
  command: "sender",
  describe: "Start the sender service",
  builder: (yargs: Argv) => {
    return yargs
      .option("private-key", {
        describe: "Ethereum Private Key",
        type: "string",
      })
      .option("log-level", {
        description: "Log level",
        type: "number",
        default: 1,
      })
      .option("receiver-identifier", {
        description: "Receiver identifier",
        type: "string",
      })
      .demandOption(["private-key"]);
  },
  handler: async (argv: { [key: string]: any } & Argv["argv"]) => {
    const NAME = "Sender";
    const TRANSFER_AMT = parseEther("0.01");
    const ethUrl = process.env.INDRA_ETH_RPC_URL;
    const nodeUrl = process.env.INDRA_NODE_URL;
    const messagingUrl = process.env.INDRA_NATS_URL;

    const log = new ColorfulLogger(NAME, 3, true, NAME);
    console.log(argv);

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
    if (!argv.receiver) {
      log.warn(`No receiver configured, returning`);
      return;
    }

    client.on(
      EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
      async (eventData: EventPayloads.LinkedTransferUnlocked) => {
        log.info(`Received transfer: ${stringify(eventData)}`);

        if (eventData.sender === client.publicIdentifier) {
          // our own transfer
          return;
        }

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

    const receiverSigner = getSignerAddressFromPublicIdentifier(argv.receiver);
    const paymentId = getRandomBytes32();
    log.info(
      `Send conditional transfer ${paymentId} for ${utils.formatEther(TRANSFER_AMT)} ETH to ${
        argv.receiver
      } (${receiverSigner})`,
    );

    await client.conditionalTransfer({
      paymentId,
      amount: TRANSFER_AMT,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      signer: receiverSigner,
      assetId: AddressZero,
      recipient: argv.receiver,
      meta: { info: "Bootstrap payment" },
    });

    log.info(`Conditional transfer ${paymentId} sent`);
  },
};
