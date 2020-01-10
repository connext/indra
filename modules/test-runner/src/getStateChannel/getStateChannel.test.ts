import { StateChannel, xkeyKthAddress } from "@connext/cf-core";
import { ClientOptions, IConnextClient, StateChannelJSON, Store, StorePair } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { parseEther } from "ethers/utils";
import { createClient, getStore } from "../util";

describe("Get State Channel", () => {
  let clientA: IConnextClient;
  let tokenAddress: string;
  let nodeFreeBalanceAddress: string;
  let nodePublicIdentifier: string;

  beforeEach(async () => {
    clientA = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodePublicIdentifier = clientA.config.nodePublicIdentifier;
    nodeFreeBalanceAddress = xkeyKthAddress(nodePublicIdentifier);
    await clientA.deposit({ amount: parseEther("0.01").toString(), assetId: AddressZero });
    await clientA.requestCollateral(tokenAddress);
  }, 90_000);

  test("Happy case: should return stateChannelJSON from store with multisig address", async () => {
    const stateChannel: StateChannelJSON = (await clientA.getStateChannel()).data;
    expect(stateChannel.multisigAddress).toBe(clientA.multisigAddress);
  });

  test("Store does not contain state channel", async () => {
    const store = getStore();
    store.reset();
    await expect(clientA.getStateChannel()).rejects.toThrowError(
      "Call to getStateChannel failed when searching for multisig address",
    );
  });

  test.only("Store contains state channel on wrong multisig address", async () => {
    const store: Store = getStore();
    // const path: `${this.storeKeyPrefix}/${DB_NAMESPACE_CHANNEL}/${stateChannel.multisigAddress}`;
    const path = "";
    const value: StateChannel = await store.get(path);

    const pair: StorePair[] = [{ path, value }];
    store.set(pair);

    await expect(clientA.getStateChannel()).rejects.toThrowError("something");
  });

  test("Store contains multiple state channels", async () => {
    // Get store from clientA
    const store: Store = getStore();
    const opts: any = { store };

    // Client with same store and new mnemonic
    const clientB = await createClient(opts);
    await clientB.deposit({ amount: parseEther("0.01").toString(), assetId: AddressZero });
    await clientB.requestCollateral(tokenAddress);

    // Now check both exist in the same store
    const stateChannelA: StateChannelJSON = (await clientA.getStateChannel()).data;
    const stateChannelB: StateChannelJSON = (await clientB.getStateChannel()).data;
    expect(stateChannelA.multisigAddress).toBe(clientA.multisigAddress);
    expect(stateChannelB.multisigAddress).toBe(clientB.multisigAddress);
  });
});
