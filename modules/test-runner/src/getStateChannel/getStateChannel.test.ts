import { StateChannel, xkeyKthAddress } from "@connext/cf-core";
import { IConnextClient, StateChannelJSON } from "@connext/types";
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
});
