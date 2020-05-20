import PQueue from "p-queue";
import { Wallet, utils, constants } from "ethers";
import { ConditionalTransferTypes, IConnextClient, BigNumber } from "@connext/types";
import { delay, getPublicIdentifierFromPublicKey, stringify, ColorfulLogger } from "@connext/utils";
import { createClient, fundChannel } from "../util";

const { hexlify, randomBytes, parseEther } = utils;
const { AddressZero, Zero } = constants;

const generatePaymentId = () => hexlify(randomBytes(32));

const TRANSFER_AMOUNT = parseEther("0.00001");
const DEPOSIT_AMOUNT = parseEther("0.1");

describe("Concurrent transfers", async () => {
  let privateKey;
  let channel;
  let indexerA: IConnextClient;
  let indexerB: IConnextClient;
  let subgraphChannels;

  before(async () => {
    // let wallet = Wallet.fromMnemonic(
    //   "favorite plunge fatigue crucial decorate bottom hour veteran embark gravity devote business",
    // );
    // privateKey = wallet.privateKey;

    channel = await createClient({
      // signer: privateKey,
      loggerService: new ColorfulLogger("Client", 1, true, "Gateway"),
    });
    indexerA = await createClient();
    indexerB = await createClient();

    console.log("Signer address:", channel.signerAddress);

    console.log("Deposit into state channel");
    await fundChannel(channel, DEPOSIT_AMOUNT, AddressZero);
    const balance: BigNumber = (await channel.getFreeBalance())[channel.signerAddress];
    console.log("Free balance:", balance.toString());
    console.log("Total # of payments possible: ", balance.div(parseEther("0.00001")).toString());

    subgraphChannels = [
      {
        signer: indexerA.signerAddress,
        publicIdentifier: indexerA.publicIdentifier,
      },
      {
        signer: indexerB.signerAddress,
        publicIdentifier: indexerB.publicIdentifier,
      },
    ];
  });

  it.skip("Can handle many concurrent transfers", async function () {
    this.timeout(0); // disable timeout
    let count = 0;
    indexerA.on("CONDITIONAL_TRANSFER_CREATED_EVENT", (data) => {
      count++;
      console.log(`${data.paymentId} Payment created: ${count}`);
    });
    indexerB.on("CONDITIONAL_TRANSFER_CREATED_EVENT", (data) => {
      count++;
      console.log(`${data.paymentId} Payment created: ${count}`);
    });
    let queue = new PQueue({ concurrency: 10 });
    let sendLoop = async () => {
      while (true) {
        for (let subgraphChannel of subgraphChannels) {
          let recipient = subgraphChannel.publicIdentifier;
          let paymentId = generatePaymentId();

          // Send payment and query
          queue.add(async () => {
            console.log(paymentId, "Send payment");
            try {
              await channel.conditionalTransfer({
                paymentId,
                amount: TRANSFER_AMOUNT,
                conditionType: ConditionalTransferTypes.SignedTransfer,
                signer: subgraphChannel.signer,
                recipient,
                assetId: AddressZero,
                meta: { info: "Query payment" },
              });
            } catch (e) {
              console.error(`Failed to send payment: ${e}`);
            }
            console.log(`${paymentId} Payment sent`);
          });
        }
        await delay(100);
      }
    };

    sendLoop();

    await queue.onIdle();
  });
});
