import { 
  MethodParams,
  DepositParameters,
  DepositResponse,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  RescindDepositRightsResponse,
  RescindDepositRightsParameters,
  CheckDepositRightsParameters,
  CheckDepositRightsResponse,
  MIN_DEPOSIT_TIMEOOUT_BLOCKS,
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
      multisigAddress, 
    } = await this.requestDepositRights({ assetId: params.assetId });
    const hash = await this.connext.channelProvider.walletTransfer({
      recipient: multisigAddress, 
      amount: params.amount.toString(),
      assetId: params.assetId, 
    });
    this.log.debug(`Sent deposit transaction to chain: ${hash}`);
    return this.rescindDepositRights({ appInstanceId, assetId: params.assetId });
  };

  public requestDepositRights = async (
    params: RequestDepositRightsParameters,
  ): Promise<RequestDepositRightsResponse> => {
    params.assetId = params.assetId ? params.assetId : AddressZero;

    const appInstanceId = await this.proposeDepositInstall(params.assetId);
  
    return {
      appInstanceId,
      multisigAddress: this.connext.multisigAddress,
    };
  }

  public rescindDepositRights = async (
    params: RescindDepositRightsParameters,
  ): Promise<RescindDepositRightsResponse> => {
    let appInstanceId;
    if (!params.appInstanceId) {
      params.assetId = params.assetId ? params.assetId : AddressZero;

      appInstanceId = this.getDepositApp({ assetId: params.assetId });
      if(!appInstanceId) {
        throw new Error(`No existing deposit app found for this tokenAddress: ${params.assetId}`);
      }
    } else {
      appInstanceId = params.appInstanceId;
    }

    this.log.debug(`Uninstalling deposit app: ${appInstanceId}`);
    await this.connext.uninstallApp(appInstanceId);
    const freeBalance = await this.connext.getFreeBalance();
    return { freeBalance };
  }

  public getDepositApp = async (
    params: CheckDepositRightsParameters,
  ): Promise<CheckDepositRightsResponse> => {
    const appInstances = await this.connext.getAppInstances();
    return { 
      appInstanceId: appInstances.filter(
        (appInstance) => 
          appInstance
            .singleAssetTwoPartyCoinTransferInterpreterParams
            .tokenAddress === params.assetId,
    )[0].identityHash };
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

    const timelock = MIN_DEPOSIT_TIMEOOUT_BLOCKS.add(await this.ethProvider.getBlockNumber());
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
      finalized: false,
      timelock,
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
