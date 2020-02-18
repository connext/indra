import {
  ConnextClientStorePrefix,
  IConnextClient,
  StateChannelJSON,
  StateSchemaVersion,
  StorePair,
} from "@connext/types";
import { AddressZero } from "ethers/constants";

import { createClient, ETH_AMOUNT_SM, expect } from "../util";

describe("Get State Channel", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    await clientA.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
  });

  it("Happy case: should return stateChannelJSON from store with multisig address", async () => {
    const stateChannel: StateChannelJSON = (await clientA.getStateChannel()).data;
    expect(stateChannel.multisigAddress).to.be.eq(clientA.multisigAddress);
  });

  it("Happy case: should return stateChannelJSON from store with proper version", async () => {
    const stateChannel: StateChannelJSON = (await clientA.getStateChannel()).data;
    expect(stateChannel.schemaVersion).to.be.eq(StateSchemaVersion);
  });

  it("Store does not contain state channel", async () => {
    clientA.store.reset!();
    await expect(clientA.getStateChannel()).to.be.rejectedWith(
      "Call to getStateChannel failed when searching for multisig address",
    );
  });

  it("Store contains multiple state channels", async () => {
    // Client with same store and new mnemonic
    const clientB = await createClient({ store: clientA.store });
    await clientB.deposit({ amount: ETH_AMOUNT_SM.toString(), assetId: AddressZero });
    await clientB.requestCollateral(tokenAddress);

    // Now check both exist in the same store
    const stateChannelA: StateChannelJSON = (await clientA.getStateChannel()).data;
    const stateChannelB: StateChannelJSON = (await clientB.getStateChannel()).data;
    expect(stateChannelA.multisigAddress).to.be.eq(clientA.multisigAddress);
    expect(stateChannelB.multisigAddress).to.be.eq(clientB.multisigAddress);
  });

  /*
    Skipping the next three tests for now. Right now, getStateChannel returns objects
    even if they're missing information or have invalid multisig addresses. These tests
    are only useful if we decide to throw errors/take recovery action on broken channels.
    Otherwise, we can just delete the following:
  */

  it.skip("Store contains state channel on wrong multisig address", async () => {
    const wrongAddress: string = "0xe8f67a5b66B01b301dF0ED1fC91F6F29B78ccf8C";
    const path: string = `${ConnextClientStorePrefix}/${clientA.publicIdentifier}/channel/${clientA.multisigAddress}`;
    const value: any = await clientA.store.get(path);

    expect(value.multisigAddress).to.be.eq((await clientA.getStateChannel()).data.multisigAddress);

    value.multisigAddress = wrongAddress;
    const pair: StorePair[] = [{ path, value }];
    await clientA.store.set(pair);

    // Expect to error in case we keep this test
    await expect(clientA.getStateChannel()).to.be.rejectedWith("");
  });

  it.skip("State channel under multisig key has no proxy factory address", async () => {
    const path: string = `${ConnextClientStorePrefix}/${clientA.publicIdentifier}/channel/${clientA.multisigAddress}`;
    const value: any = await clientA.store.get(path);

    expect(value.addresses.proxyFactory).to.be.eq(
      (await clientA.getStateChannel()).data.addresses.proxyFactory,
    );

    value.addresses.proxyFactory = null;
    const pair: StorePair[] = [{ path, value }];
    await clientA.store.set(pair);

    await expect(clientA.getStateChannel()).to.be.rejected;
  });

  it.skip("State channel under multisig key has freeBalanceAppInstance", async () => {
    const path: string = `${ConnextClientStorePrefix}/${clientA.publicIdentifier}/channel/${clientA.multisigAddress}`;
    const value: any = await clientA.store.get(path);

    // expect(value.freeBalanceAppInstance).to.be.eqDefined();

    value.freeBalanceAppInstance = null;
    const pair: StorePair[] = [{ path, value }];
    await clientA.store.set(pair);

    await expect(clientA.getStateChannel()).to.be.rejected;
  });
});
