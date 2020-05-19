import { IConnextClient, CONVENTION_FOR_ETH_ASSET_ID, EventNames } from "@connext/types";
import { getPostgresStore } from "@connext/store";
import { toBN } from "@connext/utils";
import { Sequelize } from "sequelize";

import { createClient, fundChannel, ETH_AMOUNT_MD, expect, env } from "../util";

// NOTE: only groups correct number of promises associated with a payment together.
// there is no validation done to ensure the events correspond to the payments, or
// to ensure that the event payloads are correct.
const performTransfer = async (params: any) => {
  const { ASSET, TRANSFER_AMT, sender, recipient } = params;
  const TRANSFER_PARAMS = {
    amount: TRANSFER_AMT,
    recipient: recipient.publicIdentifier,
    assetId: ASSET,
  };

  // send transfers from sender to recipient
  const [preImage] = await Promise.all([
    new Promise(async (resolve, reject) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () => reject());
      try {
        const res = await sender.transfer(TRANSFER_PARAMS);
        return resolve(res.preImage);
      } catch (e) {
        return reject(e.message);
      }
    }),
    new Promise((resolve, reject) => {
      recipient.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        return resolve(data);
      });
      recipient.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () => reject());
    }),
    new Promise((resolve) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        return resolve(data);
      });
    }),
  ]);
  return preImage;
};

describe("Full Flow: Multichannel stores (clients share single sequelize instance)", () => {
  let sender: IConnextClient;
  let recipient: IConnextClient;

  beforeEach(async () => {
    const { host, port, user: username, password, database } = env.dbConfig;
    const sequelize = new Sequelize({
      host,
      port,
      username,
      password,
      database,
      dialect: "postgres",
      logging: false,
    });
    // create stores with different prefixes
    const senderStore = getPostgresStore(sequelize, "sender");
    const recipientStore = getPostgresStore(sequelize, "recipient");
    // create clients with shared store
    sender = await createClient({ store: senderStore, id: "S" });
    recipient = await createClient({ store: recipientStore, id: "R" });
  });

  afterEach(async () => {
    await sender.messaging.disconnect();
    await recipient.messaging.disconnect();
    // clear stores
    await sender.store.clear();
    await recipient.store.clear();
  });

  it("should work when clients share the same sequelize instance with a different prefix (1 payment sent)", async () => {
    // establish tests constants
    const DEPOSIT_AMT = ETH_AMOUNT_MD;
    const ASSET = CONVENTION_FOR_ETH_ASSET_ID;
    const TRANSFER_AMT = toBN(100);
    await fundChannel(sender, DEPOSIT_AMT, ASSET);

    // get initial balances
    const initialSenderFb = await sender.getFreeBalance(ASSET);
    const initialRecipientFb = await recipient.getFreeBalance(ASSET);

    await performTransfer({
      sender,
      recipient,
      ASSET,
      TRANSFER_AMT,
    });

    // verify transfer amounts
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT),
    );
  });

  it("should work when clients share the same sequelize instance with a different prefix (many payments sent)", async () => {
    // establish tests constants
    const DEPOSIT_AMT = ETH_AMOUNT_MD;
    const ASSET = CONVENTION_FOR_ETH_ASSET_ID;
    const TRANSFER_AMT = toBN(100);
    const MIN_TRANSFERS = 25;
    const TRANSFER_INTERVAL = 500; // ms between consecutive transfer calls

    await fundChannel(sender, DEPOSIT_AMT, ASSET);

    const initialSenderFb = await sender.getFreeBalance(ASSET);
    const initialRecipientFb = await recipient.getFreeBalance(ASSET);

    let receivedTransfers = 0;
    let intervals = 0;
    let pollerError;

    // call transfers on interval
    const start = Date.now();
    const interval = setInterval(async () => {
      intervals += 1;
      if (intervals > MIN_TRANSFERS) {
        clearInterval(interval);
        return;
      }
      let error: any = undefined;
      try {
        const preImage = await performTransfer({
          sender,
          recipient,
          ASSET,
          TRANSFER_AMT,
        });
        console.log(`[${intervals}/${MIN_TRANSFERS}] preImage: ${preImage}`);
      } catch (e) {
        error = e;
      }
      if (error) {
        clearInterval(interval);
        pollerError = error.stack || error.message;
        throw new Error(pollerError);
      }
    }, TRANSFER_INTERVAL);

    // setup promise to properly wait out the transfers / stop interval
    // will also periodically check if a poller error has been set and reject
    await new Promise((resolve, reject) => {
      // setup listeners (increment on reclaim)
      recipient.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, () => {
        receivedTransfers += 1;
        if (receivedTransfers >= MIN_TRANSFERS) {
          resolve();
        }
      });
      recipient.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      sender.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);

      // register a check to see if the poller has been cleared
      setInterval(() => {
        if (pollerError) {
          reject(pollerError);
        }
      }, 250);
    });
    const end = Date.now();
    console.log(
      `Average latency of ${MIN_TRANSFERS} transfers: ${(end - start) / MIN_TRANSFERS}ms`,
    );

    expect(receivedTransfers).to.be.eq(MIN_TRANSFERS);
    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT.mul(receivedTransfers)),
    );
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT.mul(receivedTransfers)),
    );
  });
});
