import { createClient, AssetOptions, ETH_AMOUNT_SM, fundChannel, requestCollateral } from "../util";
import { IConnextClient } from "@connext/types";
import { AddressZero } from "ethers/constants";

export let clientA: IConnextClient;
export let clientB: IConnextClient;

export default async () => {
    console.log("Setting up clients")
    clientA = await createClient();
    clientB = await createClient();

    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    console.log("Funding channel")
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    console.log("requesting collateral")
    await requestCollateral(clientB, transfer.assetId);
}