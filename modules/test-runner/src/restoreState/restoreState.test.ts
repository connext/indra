import { getLocalStore } from "@connext/store";
import { IConnextClient, IChannelSigner, EventNames } from "@connext/types";
import { getRandomChannelSigner, stringify, toBN, delay } from "@connext/utils";
import { constants } from "ethers";

import {
  expect,
  TOKEN_AMOUNT,
  createClient,
  ETH_AMOUNT_SM,
  fundChannel,
  TOKEN_AMOUNT_SM,
  env,
  getNatsClient,
} from "../util";
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";

const { AddressZero, Zero } = constants;

describe("Restore State", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let signerA: IChannelSigner;

  beforeEach(async () => {
    const nats = getNatsClient();
    signerA = getRandomChannelSigner(env.ethProviderUrl);
    clientA = await createClient({ signer: signerA, store: getLocalStore() });
    tokenAddress = clientA.config.contractAddresses.Token!;
    nodeSignerAddress = clientA.nodeSignerAddress;

    const REBALANCE_PROFILE = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("0"),
      target: toBN("0"),
      reclaimThreshold: toBN("0"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(nats, clientA, REBALANCE_PROFILE);
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
  });

  it("happy case: client can delete its store and restore from a remote backup", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);

    // check balances pre
    const freeBalanceEthPre = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[clientA.signerAddress]).to.be.eq(ETH_AMOUNT_SM);
    expect(freeBalanceEthPre[nodeSignerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[clientA.signerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);

    // delete store
    await clientA.store.clear();

    // check that getting balances will now error
    await expect(clientA.getFreeBalance(AddressZero)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
    await expect(clientA.getFreeBalance(tokenAddress)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );

    await clientA.restoreState();

    // check balances post
    const freeBalanceEthPost = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPost = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPost[clientA.signerAddress]).to.be.eq(ETH_AMOUNT_SM);
    expect(freeBalanceEthPost[nodeSignerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPost[clientA.signerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPost[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);
  });

  it("happy case: client can delete its store, restore from a node backup, and receive any pending transfers", async () => {
    const transferAmount = TOKEN_AMOUNT_SM;
    const assetId = tokenAddress;
    const recipient = clientA.publicIdentifier;
    expect(recipient).to.be.eq(signerA.publicIdentifier);
    const senderClient = await createClient();
    await fundChannel(senderClient, TOKEN_AMOUNT, assetId);

    // first clear the client store and take client offline
    await clientA.store.clear();
    await clientA.messaging.disconnect();
    clientA.off();

    // send the transfer
    await Promise.all([
      new Promise((resolve, reject) => {
        senderClient.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, () => {
          return resolve();
        });
        senderClient.on(EventNames.REJECT_INSTALL_EVENT, () => {
          return reject();
        });
      }),
      senderClient.transfer({
        amount: transferAmount,
        assetId,
        recipient,
      }),
    ]);
    const freeBalanceSender = await senderClient.getFreeBalance(assetId);
    expect(freeBalanceSender[senderClient.signerAddress]).to.be.eq(
      TOKEN_AMOUNT.sub(TOKEN_AMOUNT_SM),
    );

    // bring clientA back online
    await new Promise(async (resolve, reject) => {
      clientA.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, (msg) => {
        return reject(`${clientA.publicIdentifier} failed to transfer: ${stringify(msg)}`);
      });
      clientA = await createClient({
        signer: signerA,
        id: "A2",
      });
      expect(clientA.signerAddress).to.be.eq(signerA.address);
      expect(clientA.publicIdentifier).to.be.eq(signerA.publicIdentifier);
      await delay(5000);
      return resolve();
    });

    const freeBalanceA = await clientA.getFreeBalance(assetId);
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(transferAmount);
  });
});
