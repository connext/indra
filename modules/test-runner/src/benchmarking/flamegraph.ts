import { asyncTransferAsset, AssetOptions, ETH_AMOUNT_SM } from "../util";
import { AddressZero } from "ethers/constants";
import { connect } from "@connext/client";
import { ConnextStore } from "@connext/store";
import { FILESTORAGE } from "@connext/types";

export default async () => {
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
  console.log("transferring asset");
  await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
  console.log("done");
};
