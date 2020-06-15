import {
  EventNames,
  EventName,
  IConnextClient,
  IChannelSigner,
  ProtocolNames,
  CONVENTION_FOR_ETH_ASSET_ID,
  ProtocolParams,
} from "@connext/types";
import { getRandomChannelSigner, delay } from "@connext/utils";
import { BigNumber, constants } from "ethers";
import {
  ClientTestMessagingInputOpts,
  createClient,
  createClientWithMessagingLimits,
  ETH_AMOUNT_SM,
  ethProvider,
  expect,
  fundChannel,
  SEND,
  withdrawFromChannel,
  ZERO_ZERO_ZERO_FIVE_ETH,
  env,
  APP_PROTOCOL_TOO_LONG,
  CLIENT_INSTALL_FAILED,
  RECEIVED,
} from "../util";
import { addressBook } from "@connext/contracts";

const { AddressZero } = constants;

describe("Withdraw offline tests", () => {
  let signer: IChannelSigner;
  const addr = addressBook[1337].WithdrawApp.address;

  const createAndFundChannel = async (
    messagingConfig: Partial<ClientTestMessagingInputOpts> = {},
    amount: BigNumber = ETH_AMOUNT_SM,
    assetId: string = AddressZero,
  ): Promise<IConnextClient> => {
    const client = await createClientWithMessagingLimits({
      signer,
      ...messagingConfig,
    });
    await fundChannel(client, amount, assetId);
    return client;
  };

  const sendFailingWithdrawalCall = async (
    client: IConnextClient,
    withdrawParams: any,
    error: string,
    event?: EventName,
  ) => {
    const { amount, assetId, recipient } = withdrawParams;
    if (!event) {
      await expect(withdrawFromChannel(client, amount, assetId, recipient)).to.be.rejectedWith(
        error,
      );
      return;
    }
    await new Promise(async (resolve, reject) => {
      client.once(event, (msg) => {
        try {
          expect((msg as any).params).to.be.an("object");
          expect((msg as any).error).to.include(error);
          return resolve(msg);
        } catch (e) {
          return reject(e.message);
        }
      });

      try {
        await expect(withdrawFromChannel(client, amount, assetId, recipient)).to.be.rejectedWith(
          error,
        );
      } catch (e) {
        return reject(e.message);
      }
    });
  };

  const recreateClientAndRetryWithdraw = async (client: IConnextClient, withdrawParams: any) => {
    const { amount, assetId } = withdrawParams;
    await client.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);
    const newClient = await createClient({ signer, store: client.store });
    // Check that client can recover and continue
    await withdrawFromChannel(newClient, amount, assetId);
  };

  beforeEach(async () => {
    signer = getRandomChannelSigner(env.ethProviderUrl);
  });

  it("client goes offline during withdrawal app proposal", async () => {
    const client = await createAndFundChannel({
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.propose,
      params: { appDefinition: addr },
    });
    const withdrawParams = {
      amount: ZERO_ZERO_ZERO_FIVE_ETH,
      assetId: CONVENTION_FOR_ETH_ASSET_ID,
    };

    await sendFailingWithdrawalCall(
      client,
      withdrawParams,
      APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    );

    await recreateClientAndRetryWithdraw(client, withdrawParams);
  });

  it("client goes offline during withdrawal app installation", async () => {
    const client = await createAndFundChannel({
      ceiling: { [RECEIVED]: 0 },
      protocol: ProtocolNames.install,
      params: { proposal: { appDefinition: addr } } as ProtocolParams.Install,
    });
    const withdrawParams = {
      amount: ZERO_ZERO_ZERO_FIVE_ETH,
      assetId: CONVENTION_FOR_ETH_ASSET_ID,
    };

    await sendFailingWithdrawalCall(client, withdrawParams, CLIENT_INSTALL_FAILED(true));

    await recreateClientAndRetryWithdraw(client, withdrawParams);
  });

  // NOTE: because the take-action protocol is only one message and it is always
  // initiated by the node, there is no way to properly restrict client
  // messaging in this case unless you error on `send` once the ceiling is hit.
  // Otherwise, the client will either not know the protocol has begun or not
  // realize the protocol failed for the node. In the case where the take action
  // protocol doesn't fail for the client, but does for the node, the double-
  // signed commitment will not be written to store and the client will hang
  // for 15 blocks watching the chain

  // TODO: Move this test to the node
  it.skip("client goes offline after the withdrawal transaction is submitted during the take action protocol", async () => {
    const client = await createAndFundChannel({
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.takeAction,
    });
    const withdrawParams = {
      amount: ZERO_ZERO_ZERO_FIVE_ETH,
      assetId: CONVENTION_FOR_ETH_ASSET_ID,
    };

    await sendFailingWithdrawalCall(
      client,
      withdrawParams,
      APP_PROTOCOL_TOO_LONG(ProtocolNames.takeAction),
      EventNames.UPDATE_STATE_FAILED_EVENT,
    );

    await recreateClientAndRetryWithdraw(client, withdrawParams);
  });

  it("client goes offline before node finishes submitting withdrawal (commitment is written to store and retried)", async () => {
    const client = await createAndFundChannel();
    const withdrawParams = {
      amount: ZERO_ZERO_ZERO_FIVE_ETH,
      assetId: CONVENTION_FOR_ETH_ASSET_ID,
    };

    const startingBalance = await ethProvider.getBalance(client.multisigAddress);

    await Promise.all([
      new Promise((resolve) => {
        // disconnect once withdrawal commitment is written to store
        client.once(EventNames.UPDATE_STATE_EVENT, async () => {
          // TODO: why do we have to wait here when the handler is awaiting
          // changes before emitting events?
          // make sure any updates to the store from event have time to be
          // written
          await delay(500);
          await client.messaging.disconnect();
          resolve();
        });
        // promise will not resolve until it fails to find tx, dont await
        withdrawFromChannel(client, withdrawParams.amount, withdrawParams.assetId);
      }),
      // make sure the onchain tx was submitted successfully
      new Promise(async (resolve) => {
        ethProvider.on("block", async () => {
          const balance = await ethProvider.getBalance(client.multisigAddress);
          if (!balance.eq(startingBalance)) {
            ethProvider.off("block");
            resolve();
          }
        });
      }),
    ]);

    const [val] = await client.store.getUserWithdrawals!();
    expect(val).to.not.be.undefined;
    expect(val.tx).to.not.be.undefined;
    expect(val.retry).to.be.equal(0);
    expect(val.tx).to.be.containSubset({ to: client.multisigAddress, value: 0 });
    // restart the client
    const reconnected = await createClient({
      signer,
      store: client.store,
    });

    // make sure the withdrawal has been handled
    const [resubmitted] = await reconnected.store.getUserWithdrawals();
    expect(resubmitted).to.be.undefined;
  });
});
