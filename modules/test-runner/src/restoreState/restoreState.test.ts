import { IConnextClient, IChannelSigner, EventNames, EventPayloads, StoreTypes } from "@connext/types";
import { AddressZero, Zero } from "ethers/constants";

import { expect, TOKEN_AMOUNT, createClient, ETH_AMOUNT_SM, fundChannel, TOKEN_AMOUNT_SM, env } from "../util";
import { getRandomChannelSigner, stringify } from "@connext/utils";
import { ConnextStore } from "@connext/store";

describe("Restore State", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let signerA: IChannelSigner;

  beforeEach(async () => {
    signerA = getRandomChannelSigner(env.ethProviderUrl);
    clientA = await createClient({ signer: signerA });
    tokenAddress = clientA.config.contractAddresses.Token;
    nodeSignerAddress = clientA.nodeSignerAddress;
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
    clientA.store.clear();

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

  it.only("happy case: client can delete its store, restore from a node backup, and receive any pending transfers", async () => {
    clientA = await createClient({ 
      signer: signerA, 
      store: new ConnextStore(StoreTypes.Memory),
    });
    const transferAmount = TOKEN_AMOUNT_SM;
    const assetId = tokenAddress;
    const recipient = clientA.publicIdentifier;
    expect(recipient).to.be.eq(signerA.publicIdentifier);
    console.log(`[test] recipient created (${recipient})`);
    const senderClient = await createClient();
    await fundChannel(senderClient, TOKEN_AMOUNT, assetId);
    console.log(`[test] funded sender channel (${senderClient.publicIdentifier})`);

    // // first clear the client store and take client offline
    // // await clientA.store.clear();
    // // console.log(`[test] cleared clientA store`);
    // await clientA.messaging.disconnect();
    // console.log(`[test] disconnected clientA messaging`);

    // send the transfer
    await Promise.all([
      new Promise((resolve, reject) => {
        senderClient.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, () => {
          console.log(`[test] sender created transfer`);
          return resolve();
        });
        senderClient.on(EventNames.REJECT_INSTALL_EVENT, () => {
          console.log(`[test] sender failed to create transfer`);
          return reject();
        });
      }),
      new Promise(async resolve => {
        console.log(`[test] ${senderClient.publicIdentifier} transfering ${transferAmount.toString()} of ${tokenAddress} to ${clientA.publicIdentifier}`);
        const result = await senderClient.transfer({
          amount: transferAmount,
          assetId,
          recipient,
        });
        return resolve(result);
      }),
    ]);
    const freeBalanceSender = await senderClient.getFreeBalance(assetId);
    expect(freeBalanceSender[senderClient.signerAddress]).to.be.eq(
      TOKEN_AMOUNT.sub(TOKEN_AMOUNT_SM),
    );
    console.log(`[test] verified sender transfer`);

    // await delay(90_000);

    // bring clientA back online
    await new Promise(async (resolve, reject) => {
      clientA.on(
        EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, 
        (msg: EventPayloads.LinkedTransferFailed) => {
          return reject(`${clientA.publicIdentifier} failed to transfer: ${stringify(msg, 2)}`);
      });
      clientA.on(
        EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, 
        (msg: EventPayloads.LinkedTransferUnlocked) => {
          console.log(`received linked transfer:`, msg);
          return resolve();
      });
      // clientA = await createClient({ 
      //   signer: signerA, 
      //   store: new ConnextStore(StoreTypes.Memory),
      // });
      // expect(clientA.signerAddress).to.be.eq(signerA.address);
      // expect(clientA.publicIdentifier).to.be.eq(signerA.publicIdentifier);
      // console.log(`[test] recreated clientA ${clientA.publicIdentifier}`);
      // return resolve();
    });

    const freeBalanceA = await clientA.getFreeBalance(assetId);
    console.log(`[test] got free balanceA`, freeBalanceA);
    expect(freeBalanceA[clientA.signerAddress]).to.be.eq(transferAmount);
  });
});
