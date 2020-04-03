import { 
  MethodParams,
  DepositParameters,
  DepositResponse,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  RescindDepositRightsResponse,
  RescindDepositRightsParameters,
  CheckDepositRightsParameters,
  AppInstanceJson,
  DefaultApp,
} from "@connext/types";
import { MinimumViableMultisig } from "@connext/contracts";
import { DepositAppName, DepositAppState } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { AbstractController } from "./AbstractController";
import { BigNumber } from "ethers/utils";

export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<DepositResponse> => {
    const { 
      appInstanceId, 
    } = await this.requestDepositRights({ assetId: params.assetId });
    const hash = await this.connext.channelProvider.walletTransfer({
      recipient: this.connext.multisigAddress, 
      amount: params.amount.toString(),
      assetId: params.assetId, 
    });
    this.log.debug(`Sent deposit transaction to chain: ${hash}`);
    return this.rescindDepositRights({ appInstanceId, assetId: params.assetId });
  };

  public requestDepositRights = async (
    params: RequestDepositRightsParameters,
  ): Promise<RequestDepositRightsResponse> => {
    const assetId = params.assetId || AddressZero;
    const depositApp = await this.getDepositApp({ assetId });
    
    if (!depositApp) {
      this.log.debug(`No deposit app installed for ${assetId}. Installing.`);
      const appInstanceId = await this.proposeDepositInstall(assetId);
      return {
        appInstanceId,
        multisigAddress: this.connext.multisigAddress,
      };
    }

    this.log.debug(`Found existing deposit app`);
    const latestState = depositApp.latestState as DepositAppState;

    // check if you are the initiator;
    const initiatorTransfer = latestState.transfers[0];
    if (initiatorTransfer.to !== this.connext.freeBalanceAddress) {
      throw new Error(`Node has unfinalized deposit, cannot request deposit rights for ${assetId}`);
    }

    this.log.debug(`Found existing, unfinalized deposit app for ${assetId}, doing nothing. (deposit app: ${depositApp.identityHash})`);
    return {
      appInstanceId: depositApp.identityHash,
      multisigAddress: this.connext.multisigAddress,
    };
  }

  public rescindDepositRights = async (
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse> => {
    const assetId = params.assetId || AddressZero;
    // get the app instance
    const app = await this.getDepositApp({ assetId });
    if (!app) {
      this.log.debug(`No deposit app found for assset: ${assetId}`);
      const freeBalance = await this.connext.getFreeBalance(assetId);
      return { freeBalance };
    }
  
    this.log.debug(`Uninstalling ${app.identityHash}`);
    await this.connext.uninstallApp(app.identityHash);
    this.log.debug(`Uninstalled deposit app`);
    const freeBalance = await this.connext.getFreeBalance(assetId);
    return { freeBalance };
  }

  public getDepositApp = async (
    params: CheckDepositRightsParameters,
  ): Promise<AppInstanceJson | undefined> => {
    const appInstances = await this.connext.getAppInstances();
    const depositAppInfo = await this.connext.getAppRegistry({
      name: DepositAppName,
      chainId: this.ethProvider.network.chainId,
    }) as DefaultApp;
    const depositApp = appInstances.find(
      (appInstance) =>
        appInstance.appInterface.addr === depositAppInfo.appDefinitionAddress &&
        (appInstance.latestState as DepositAppState).assetId === params.assetId,
    );

    if (!depositApp) {
      return undefined;
    }

    return depositApp;
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (
    assetId: string,
  ): Promise<string> => {
    const token = new Contract(assetId!, tokenAbi, this.ethProvider);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(
      this.connext.multisigAddress,
      MinimumViableMultisig.abi,
      this.ethProvider,
    );

    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(assetId);
    } catch (e) {
      const NOT_DEPLOYED_ERR = `contract not deployed (contractAddress="${this.connext.multisigAddress}"`;
      if (!e.message.includes(NOT_DEPLOYED_ERR)) {
        throw new Error(e);
      }
      // multisig is deployed on withdrawal, if not
      // deployed withdrawal amount is 0
      startingTotalAmountWithdrawn = Zero;
    }

    // generate starting multisig balance
    const startingMultisigBalance =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await token.functions.balanceOf(this.connext.multisigAddress);

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: this.connext.freeBalanceAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeFreeBalanceAddress,
        },
      ],
      multisigAddress: this.connext.multisigAddress,
      assetId,
      startingTotalAmountWithdrawn, 
      startingMultisigBalance,
    };

    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = this.connext.getRegisteredAppDetails(DepositAppName);

    const params: MethodParams.ProposeInstall = {
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

    const appId = await this.proposeAndInstallLedgerApp(params);
    return appId;
  };
}
