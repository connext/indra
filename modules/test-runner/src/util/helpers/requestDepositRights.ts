import { utils } from "@connext/client";
import { AppInstanceJson, IConnextClient, DepositAppState } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { expect } from "../";
import { ethProvider } from "../ethprovider";
import { bigNumberify } from "ethers/utils";

const { xpubToAddress } = utils;

export const requestDepositRights = async (
  client: IConnextClient,
  assetId: string = AddressZero,
  clientIsRecipient: boolean = true,
): Promise<void> => {
  // NOTE: will use instantaneous multisig balance as the assumed balance
  const multisigBalance =
    assetId === AddressZero
      ? await ethProvider.getBalance(client.multisigAddress)
      : await new Contract(assetId, tokenAbi, ethProvider).functions.balanceOf(
          client.multisigAddress,
        );
  // get coin balance app details
  const {
    actionEncoding,
    appDefinitionAddress: appDefinition,
    stateEncoding,
    outcomeType,
  } = client.getRegisteredAppDetails("DepositApp");
  // install the app and get the state
  let depositApp: DepositAppState;
  if (clientIsRecipient) {
    // give client rights
    await client.requestDepositRights({ assetId });
    // get latest installed app
    const latestApp = (await client.getAppInstances()).sort(
      (a: AppInstanceJson, b: AppInstanceJson) => b.appSeqNo - a.appSeqNo,
    )[0];
    // make sure its the coin balance refund app
    expect(latestApp.appInterface.addr).to.be.eq(appDefinition);
    depositApp = latestApp.latestState as DepositAppState;
  } else {
    // node is installing, params must be manually generated
    const initialState = {
      multisig: client.multisigAddress,
      recipient: xpubToAddress(client.nodePublicIdentifier),
      threshold: multisigBalance,
      tokenAddress: assetId,
    };

    const params = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: client.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };
    const { appInstanceId } = await client.proposeInstallApp(params);
    // hub will not automatically install, so manually install app
    const { appInstance } = await client.installApp(appInstanceId);
    // get latest deposit state
    depositApp = appInstance.latestState as DepositAppState;
  }
  // verify the latest deposit state is correct
  expect(depositApp.multisigAddress).to.be.eq(client.multisigAddress);
  expect(depositApp.assetId).to.be.eq(assetId);
  expect(bigNumberify(depositApp.startingMultisigBalance).toString()).to.be.eq(
    multisigBalance.toString(),
  );
  expect(bigNumberify(depositApp.startingTotalAmountWithdrawn).toString()).to.be.eq(
    Zero,
  );
  const transfers = depositApp.transfers;
  expect(transfers[0].amount).to.be.eq(Zero);
  expect(transfers[1].amount).to.be.eq(Zero);
  expect(transfers[0].to).to.be.eq(client.freeBalanceAddress);
  expect(transfers[1].to).to.be.eq(client.nodeFreeBalanceAddress);
};
