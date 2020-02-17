import { createClient, AssetOptions, ETH_AMOUNT_SM, fundChannel, requestCollateral } from "../util";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { ConnextStore, FileStorage } from "@connext/store";
import { connect } from "@connext/client";

export let clientA: IConnextClient;
export let clientB: IConnextClient;

export default async () => {
  console.log("Setting up clients");
  const clientA = await connect({
    mnemonic: "harsh cancel view follow approve digital tool cram physical easily lend cinnamon betray scene round",
    nodeUrl: "nats://localhost:4222",
    ethProviderUrl: "http://localhost:8545",
    store: new ConnextStore(new FileStorage()),
  });
  const clientB = await connect({
    mnemonic: "mom shrimp way ripple gravity scene eyebrow topic enlist apple analyst shell obscure midnight buddy",
    nodeUrl: "nats://localhost:4222",
    ethProviderUrl: "http://localhost:8545",
    store: new ConnextStore(new FileStorage()),
  });

  const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
  console.log("Funding channel");
  await fundChannel(clientA, transfer.amount, transfer.assetId);
  console.log("requesting collateral");
  await requestCollateral(clientB, transfer.assetId);
};
