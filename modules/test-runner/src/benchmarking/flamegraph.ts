import { asyncTransferAsset, AssetOptions, ETH_AMOUNT_SM } from "../util";
import { clientA, clientB } from "./flamegraphPrep"
import { AddressZero } from "ethers/constants";

export default async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    console.log("transferring asset")
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
    console.log("done")
}