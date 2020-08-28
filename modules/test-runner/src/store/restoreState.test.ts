import { getLocalStore } from "@connext/store";
import {
  IConnextClient,
  IChannelSigner,
  EventNames,
  CF_METHOD_TIMEOUT,
  IStoreService,
} from "@connext/types";
import { getRandomChannelSigner, toBN, delay } from "@connext/utils";
import { constants } from "ethers";

import {
  addRebalanceProfile,
  createClient,
  ETH_AMOUNT_SM,
  ethProvider,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
  TOKEN_AMOUNT,
  TOKEN_AMOUNT_SM,
} from "../util";

const { AddressZero, Zero } = constants;

const name = "Restore State";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let nodeSignerAddress: string;
  let signerA: IChannelSigner;
  let start: number;
  let store: IStoreService;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    signerA = getRandomChannelSigner(ethProviderUrl);
    store = getLocalStore();
    clientA = await createClient({ signer: signerA, store, id: "A" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    nodeSignerAddress = clientA.nodeSignerAddress;
    const REBALANCE_PROFILE = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("0"),
      target: toBN("0"),
      reclaimThreshold: toBN("0"),
    };
    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(clientA, REBALANCE_PROFILE);
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    clientA.off();
  });

  it("client can delete its store and restore from a remote backup", async () => {
    // client deposit and request node collateral
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });

    const response = await clientA.requestCollateral(tokenAddress);
    expect(response).to.be.ok;
    await ethProvider.waitForTransaction(response!.transaction.hash);
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
    await clientA.off();
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

  it("client can delete its store, restore from a node backup, and receive any pending transfers", async () => {
    const transferAmount = TOKEN_AMOUNT_SM;
    const assetId = tokenAddress;
    const recipient = clientA.publicIdentifier;
    expect(recipient).to.be.eq(signerA.publicIdentifier);
    const preTransfer = await clientA.getFreeBalance(assetId);
    const senderClient = await createClient({ id: "S" });
    await fundChannel(senderClient, TOKEN_AMOUNT, assetId);

    // first clear the client store and take client offline
    await store.clear();
    await clientA.off();

    // send the transfer
    const sent = senderClient.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 30_000);
    await senderClient.transfer({
      amount: transferAmount,
      assetId,
      recipient,
    });
    const createRes = await sent;

    // delay so that the node -> receiver proposal times out
    // wait out for the entire lock service
    const timer = CF_METHOD_TIMEOUT + 1500;
    await delay(timer * 2);

    const freeBalanceSender = await senderClient.getFreeBalance(assetId);
    expect(freeBalanceSender[senderClient.signerAddress]).to.be.eq(
      TOKEN_AMOUNT.sub(TOKEN_AMOUNT_SM),
    );

    // bring clientA back online
    const unlocked = new Promise((resolve, reject) => {
      senderClient.once(
        EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
        resolve,
        (msg) => msg.paymentId === createRes.paymentId,
      );
      senderClient.once(
        EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT,
        (msg) => reject(msg.error),
        (msg) => msg.paymentId === createRes.paymentId,
      );
      delay(10_000).then(() => reject(`No events thrown in 10s`));
    });
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
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(
      preTransfer[clientA.signerAddress].add(transferAmount),
    );
  });
});
