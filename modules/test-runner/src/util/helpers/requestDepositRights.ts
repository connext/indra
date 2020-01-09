import { InstallMessage } from "@connext/cf-core";
import { utils } from "@connext/client";
import { CoinBalanceRefundAppState, IConnextClient, SupportedApplications } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { ethProvider } from "../ethprovider";

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
  // give client rights
  await new Promise(async resolve => {
    client.once("INSTALL_EVENT", async (msg: InstallMessage) => {
      const { appInstance } = await client.getAppInstanceDetails(msg.data.params.appInstanceId);
      // assert the app state is correct
      const state = appInstance.latestState as CoinBalanceRefundAppState;
      expect(state.tokenAddress).toEqual(assetId);
      expect(state.recipient).toEqual(
        clientIsRecipient ? client.freeBalanceAddress : xpubToAddress(client.nodePublicIdentifier),
      );
      expect(state.multisig).toEqual(client.multisigAddress);
      // assert threshold is correct
      expect(bigNumberify(state.threshold)).toBeBigNumberEq(multisigBalance);
      resolve();
    });

    // make the request call
    if (clientIsRecipient) {
      await client.requestDepositRights({ assetId });
    } else {
      // node is installing, params must be manually generated
      const initialState = {
        multisig: client.multisigAddress,
        recipient: xpubToAddress(client.nodePublicIdentifier),
        threshold: multisigBalance,
        tokenAddress: assetId,
      };

      const {
        actionEncoding,
        appDefinitionAddress: appDefinition,
        stateEncoding,
        outcomeType,
      } = client.getRegisteredAppDetails(SupportedApplications.CoinBalanceRefundApp as any);

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
      await client.proposeInstallApp(params);
    }
  });
};
