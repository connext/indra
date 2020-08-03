import { getLocalStore } from "@connext/store";
import { IConnextClient, IChannelSigner, EventNames, IStoreService } from "@connext/types";
import { getRandomChannelSigner, toBN, delay } from "@connext/utils";
import { constants } from "ethers";

import {
  createClient,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  ethProvider,
  expect,
  fundChannel,
  getNatsClient,
  TOKEN_AMOUNT,
  TOKEN_AMOUNT_SM,
} from "../util";
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";

const { AddressZero, Zero } = constants;

describe("Restore State", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let signerA: IChannelSigner;
  let store: IStoreService;

  beforeEach(async () => {
    const nats = getNatsClient();
    signerA = getRandomChannelSigner(ethProviderUrl);
    store = getLocalStore();
    clientA = await createClient({ signer: signerA, store });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
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

    // TODO: rm 'as any' once type returned by requestCollateral is fixed
    const tx = (await clientA.requestCollateral(tokenAddress)) as any;
    await ethProvider.waitForTransaction(tx.hash);
    await clientA.waitFor(EventNames.UNINSTALL_EVENT, 10_000);

    // Wait for the node to uninstall the deposit app & persist too
    await delay(200);

    // check balances pre
    const freeBalanceEthPre = await clientA.getFreeBalance(AddressZero);
    const freeBalanceTokenPre = await clientA.getFreeBalance(tokenAddress);
    expect(freeBalanceEthPre[clientA.signerAddress]).to.be.eq(ETH_AMOUNT_SM);
    expect(freeBalanceEthPre[nodeSignerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[clientA.signerAddress]).to.be.eq(Zero);
    expect(freeBalanceTokenPre[nodeSignerAddress]).to.be.least(TOKEN_AMOUNT);

    // delete store
    await store.clear();

    // check that getting balances will now error
    await expect(clientA.getFreeBalance(AddressZero)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
    await expect(clientA.getFreeBalance(tokenAddress)).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
    await clientA.messaging.disconnect();
    clientA.off();
    await delay(1000);

    // recreate client
    clientA = await createClient({ signer: signerA, store });

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
    await store.clear();
    await clientA.messaging.disconnect();
    clientA.off();

    // send the transfer
    const sent = senderClient.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    await senderClient.transfer({
      amount: transferAmount,
      assetId,
      recipient,
    });
    await sent;

    // delay so that the node -> receiver proposal times out
    await delay(30_000);

    const freeBalanceSender = await senderClient.getFreeBalance(assetId);
    expect(freeBalanceSender[senderClient.signerAddress]).to.be.eq(
      TOKEN_AMOUNT.sub(TOKEN_AMOUNT_SM),
    );

    // bring clientA back online
    const unlocked = senderClient.waitFor(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 10_000);
    clientA = await createClient(
      {
        signer: signerA,
        id: "A-recreated",
      },
      false,
    );
    expect(clientA.signerAddress).to.be.eq(signerA.address);
    expect(clientA.publicIdentifier).to.be.eq(signerA.publicIdentifier);
    await unlocked;

    const freeBalanceA = await clientA.getFreeBalance(assetId);
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(transferAmount);
  });
});
