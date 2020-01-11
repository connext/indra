import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { bigNumberify } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { stringify } from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  CoinBalanceRefundAppStateBigNumber,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  SupportedApplications,
} from "../types";
import { invalidAddress, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class RequestDepositRightsController extends AbstractController {
  public requestDepositRights = async (
    params: RequestDepositRightsParameters,
  ): Promise<RequestDepositRightsResponse> => {
    const assetId = params.assetId || AddressZero;
    validate(invalidAddress(assetId));

    let multisigBalance: BigNumber;
    if (assetId === AddressZero) {
      multisigBalance = await this.connext.ethProvider.getBalance(this.connext.multisigAddress);
    } else {
      const token = new Contract(assetId, tokenAbi, this.connext.ethProvider);
      multisigBalance = await token.balanceOf(this.connext.multisigAddress);
    }

    // make sure there is not a collateralization in flight
    const { collateralizationInFlight } = await this.node.getChannel();
    if (collateralizationInFlight) {
      throw new Error(`Cannot claim deposit rights while hub is depositing.`);
    }

    const existingBalanceRefundApp = await this.connext.getBalanceRefundApp(assetId);
    if (existingBalanceRefundApp) {
      if (
        bigNumberify(existingBalanceRefundApp.latestState["threshold"]).eq(multisigBalance) &&
        existingBalanceRefundApp.latestState["recipient"] === this.connext.freeBalanceAddress
      ) {
        this.log.info(`Balance refund app for ${assetId} is in the correct state, doing nothing`);
        return {
          freeBalance: await this.connext.getFreeBalance(assetId),
          recipient: this.connext.freeBalanceAddress,
          tokenAddress: assetId,
        };
      }
      this.log.info(`Balance refund app is not in the correct state, uninstalling first`);
      await this.connext.rescindDepositRights({ assetId });
      this.log.info(`Balance refund app uninstalled`);
    }
    // propose the app install
    this.log.info(`Installing balance refund app for ${assetId}`);
    await this.proposeDepositInstall(assetId);
    const requestDepositRightsResponse = await this.channelProvider.send(
      CFCoreTypes.RpcMethodNames.chan_requestDepositRights as CFCoreTypes.RpcMethodName,
      {
        multisigAddress: this.channelProvider.multisigAddress,
        tokenAddress: assetId,
      } as CFCoreTypes.RequestDepositRightsParams,
    );
    this.log.debug(
      `requestDepositRightsResponse Response: ${stringify(requestDepositRightsResponse)}`,
    );
    this.log.info(`Deposit rights gained for ${assetId}`);

    const freeBalance = await this.connext.getFreeBalance(assetId);

    return {
      freeBalance,
      recipient: this.connext.freeBalanceAddress,
      tokenAddress: assetId,
    };
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (assetId: string): Promise<string | undefined> => {
    const threshold =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await new Contract(assetId!, tokenAbi, this.ethProvider).functions.balanceOf(
            this.connext.multisigAddress,
          );

    const initialState: CoinBalanceRefundAppStateBigNumber = {
      multisig: this.connext.multisigAddress,
      recipient: this.connext.freeBalanceAddress,
      threshold,
      tokenAddress: assetId,
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(SupportedApplications.CoinBalanceRefundApp as any);

    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositTokenAddress: assetId,
      outcomeType,
      proposedToIdentifier: this.connext.nodePublicIdentifier,
      responderDeposit: Zero,
      responderDepositTokenAddress: assetId,
      timeout: Zero,
    };

    const appId = await this.proposeAndWaitForAccepted(params);
    return appId;
  };
}
