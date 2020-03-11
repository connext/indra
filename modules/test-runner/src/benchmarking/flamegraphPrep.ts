import { AssetOptions, ETH_AMOUNT_SM, env, fundChannel, Logger, requestCollateral } from "../util";
import { IConnextClient, FILESTORAGE } from "@connext/types";
import { AddressZero } from "ethers/constants";
import { ConnextStore } from "@connext/store";
import { connect } from "@connext/client";

export let clientA: IConnextClient;
export let clientB: IConnextClient;

export default async () => {
  const log = new Logger("FlamegraphPrep", env.logLevel);
  log.info("Setting up clients");
  const clientA = await connect({
    mnemonic:
      "harsh cancel view follow approve digital tool cram physical easily lend cinnamon betray scene round",
    nodeUrl: "nats://localhost:4222",
    ethProviderUrl: "http://localhost:8545",
    store: new ConnextStore(FILESTORAGE),
  });
  const clientB = await connect({
    mnemonic:
      "mom shrimp way ripple gravity scene eyebrow topic enlist apple analyst shell obscure midnight buddy",
    nodeUrl: "nats://localhost:4222",
    ethProviderUrl: "http://localhost:8545",
    store: new ConnextStore(FILESTORAGE),
  });

  const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
  log.info("Funding channel");
  await fundChannel(clientA, transfer.amount, transfer.assetId);
  log.info("requesting collateral");
  await requestCollateral(clientB, transfer.assetId);
};
