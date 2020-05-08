import {
  IConnextClient,
  StoreTypes,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventNames,
  PublicResults,
  ConditionalTransferTypes,
} from "@connext/types";
import { ConnextStore } from "@connext/store";
import { toBN, stringify } from "@connext/utils";
import { Sequelize } from "sequelize";

import { createClient, fundChannel, ETH_AMOUNT_MD, expect, env } from "../util";

// NOTE: this fn is used instead of the 'asyncTransferAsset' helper because
// it will be used more than once, and the 'asyncTransferAsset' is too restrictive in its
// assertions for remaining app instances after a transfer is complete. Additionally,
// these tests will emphasize the event data payload correctness instead of the transfer
// storage/history correctness.
const performTransfer = async (params: any) => {
  const { ASSET, TRANSFER_AMT, sender, recipient } = params;
  const TRANSFER_PARAMS = {
    amount: TRANSFER_AMT,
    recipient: recipient.publicIdentifier,
    assetId: ASSET,
  };

  // send transfers from sender to recipient
  const [
    transferRes,
    transferCreatedEvent,
    unlockedSenderEvent,
    unlockedReceiverEvent,
  ] = await Promise.all([
    new Promise(async (resolve, reject) => {
      try {
        console.log("trying to transfer with params:", TRANSFER_PARAMS);
        const res = await sender.transfer(TRANSFER_PARAMS);
        console.log("transferred from sender");
        return resolve(res);
      } catch (e) {
        return reject(e.message);
      }
    }),
    new Promise((resolve, reject) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (data) => {
        console.log("sender got created event");
        return resolve(data);
      });

      sender.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () => reject());
    }),
    new Promise((resolve) => {
      sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        console.log("sender got unlocked event (should be reclaimed)");
        return resolve(data);
      });
    }),
    new Promise((resolve) => {
      recipient.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
        console.log("receiver got unlocked event (should be redeemed)");
        return resolve(data);
      });
    }),
  ]);

  // verify sender response is properly constructed
  const { appIdentityHash, paymentId, preImage } = transferRes as PublicResults.LinkedTransfer;
  expect(appIdentityHash).to.ok;
  expect(paymentId).to.ok;
  expect(preImage).to.ok;

  // construct expected events
  const createdEvent = {
    type: ConditionalTransferTypes.LinkedTransfer,
    amount: TRANSFER_AMT,
    paymentId,
    assetId: ASSET,
    sender: sender.publicIdentifier,
    recipient: recipient.publicIdentifier,
    meta: {
      sender: sender.publicIdentifier,
      recipient: recipient.publicIdentifier,
    },
  };
  const unlockedExpected = {
    ...createdEvent,
    transferMeta: { preImage },
  };
  console.log("transferCreatedEvent", stringify(transferCreatedEvent));
  console.log("unlockedReceiverEvent", stringify(unlockedReceiverEvent));
  console.log("unlockedSenderEvent", stringify(unlockedSenderEvent));
  expect(transferCreatedEvent).to.containSubset(createdEvent);
  expect(unlockedReceiverEvent).to.containSubset(unlockedExpected);
  expect(unlockedSenderEvent).to.containSubset(unlockedExpected);
};

describe("Full Flow: Multichannel stores (clients share single sequelize instance)", () => {
  let sender: IConnextClient;
  let recipient: IConnextClient;

  beforeEach(async () => {
    const {
      host,
      port,
      user: username,
      password,
      database,
    } = env.dbConfig;
    const sequelizeConfig = {
      host,
      port,
      username,
      password,
      database,
      dialect: "postgres",
    };
    console.log("******* creating sequelize connection with config:", stringify(sequelizeConfig));
    const sequelize = new Sequelize(sequelizeConfig as any);
    // create stores with different prefixes
    const storeA = new ConnextStore(StoreTypes.Memory, { sequelize });
    const storeB = new ConnextStore(StoreTypes.Memory, { sequelize, prefix: `recipient` });
    // create clients with shared store
    sender = await createClient({ store: storeA });
    recipient = await createClient({ store: storeB });
  });

  afterEach(async () => {
    await sender.messaging.disconnect();
    await recipient.messaging.disconnect();
    // // clear stores
    // await sender.store.clear();
    // await recipient.store.clear();
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

  it.only("should work when clients share the same sequelize instance with a different prefix (many payments sent)", async () => {
    // establish tests constants
    const DEPOSIT_AMT = ETH_AMOUNT_MD;
    const ASSET = CONVENTION_FOR_ETH_ASSET_ID;
    const TRANSFER_AMT = toBN(100);
    const MIN_TRANSFERS = 5;
    const TRANSFER_INTERVAL = 500; // ms between consecutive transfer calls

    await fundChannel(sender, DEPOSIT_AMT, ASSET);

    const initialSenderFb = await sender.getFreeBalance(ASSET);
    const initialRecipientFb = await recipient.getFreeBalance(ASSET);

    let successfulTransfers = 0;
    let pollerError;

    // call transfers on interval
    const interval = setInterval(async () => {
      let error: any = undefined;
      try {
        await performTransfer({
          sender,
          recipient,
          ASSET,
          TRANSFER_AMT,
        });
      } catch (e) {
        error = e;
      }
      if (error) {
        console.log(`**** got error with transfer ${successfulTransfers}/${MIN_TRANSFERS}, trying to clear interval`);
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
        successfulTransfers += 1;
        console.log(`**** got transfer ${successfulTransfers}/${MIN_TRANSFERS}!`);
        if (successfulTransfers >= MIN_TRANSFERS) {
          clearInterval(interval);
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

    expect(successfulTransfers).to.be.eq(MIN_TRANSFERS);

    const finalSenderFb = await sender.getFreeBalance(ASSET);
    const finalRecipientFb = await recipient.getFreeBalance(ASSET);
    console.log("asserting final sender free balance");
    expect(finalSenderFb[sender.signerAddress]).to.be.eq(
      initialSenderFb[sender.signerAddress].sub(TRANSFER_AMT.mul(successfulTransfers)),
    );
    console.log("asserting final recipient free balance");
    expect(finalRecipientFb[recipient.signerAddress]).to.be.eq(
      initialRecipientFb[recipient.signerAddress].add(TRANSFER_AMT.mul(successfulTransfers)),
    );
  });
});
