import { IConnextClient, StateChannelJSON } from "@connext/types";
import { createClient } from "../util";
import { xkeyKthAddress, StateChannel } from "@connext/cf-core";
import { parseEther } from "ethers/utils";
import { AddressZero } from "ethers/constants";

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

});
