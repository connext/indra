import { createClient, AssetOptions, ETH_AMOUNT_SM, fundChannel, requestCollateral, asyncTransferAsset } from "../util";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

export default async () => {
    console.log("Setting up clients")
    const clientA: IConnextClient = await createClient();
    const clientB: IConnextClient = await createClient();

    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    console.log("Funding channel")
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    console.log("requesting collateral")
    await requestCollateral(clientB, transfer.assetId);
    console.log("transferring asset")
    await asyncTransferAsset(clientA, clientB, transfer.amount, transfer.assetId);
    console.log("done")
}