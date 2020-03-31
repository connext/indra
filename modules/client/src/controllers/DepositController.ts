import { MethodParams, toBN, DepositParameters, DepositResponse, RequestDepositRightsParameters, RequestDepositRightsResponse, RescindDepositRightsResponse, RescindDepositRightsParameters, CheckDepositRightsParameters, CheckDepositRightsResponse } from "@connext/types";
import { MinimumViableMultisig, ERC20 } from "@connext/contracts";
import { DepositAppName, DepositAppState } from "@connext/types";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { AbstractController } from "./AbstractController";

export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<DepositResponse> => {
    const amount = toBN(params.amount)
    const { appInstanceId, multisigAddress } = await this.requestDepositRights({assetId: params.assetId})
    if(params.assetId == AddressZero) {
      // attempt to send Eth tx TODO
    } else {
      const erc20 = new Contract(params.assetId, ERC20.abi, this.ethProvider);
      // attempt to send erc20 tx TODO
    }
    return this.rescindDepositRights({appInstanceId});
  };

  public requestDepositRights = async (params: RequestDepositRightsParameters): Promise<RequestDepositRightsResponse> => {
    params.assetId = params.assetId ? params.assetId : AddressZero;

    const appInstanceId = await this.proposeDepositInstall(params.assetId)
  
    return {
      appInstanceId,
      multisigAddress: this.connext.multisigAddress
    }
  }

  public rescindDepositRights = async (params: RescindDepositRightsParameters): Promise<RescindDepositRightsResponse> => {
    let appInstanceId
    if (!params.appInstanceId) {
      params.assetId = params.assetId ? params.assetId : AddressZero;

      appInstanceId = this.getDepositApp({assetId: params.assetId});
      if(!appInstanceId) {
        throw new Error(`No existing deposit app found for this tokenAddress: ${params.assetId}`)
      }
    } else {
      appInstanceId = params.appInstanceId;
    }

    this.log.debug(`Uninstalling deposit app`)
    await this.connext.uninstallApp(appInstanceId);
    const freeBalance = await this.connext.getFreeBalance();
    return { freeBalance };
  }

  public getDepositApp = async (params: CheckDepositRightsParameters): Promise<CheckDepositRightsResponse> => {
    const appInstances = await this.connext.getAppInstances()
    return { appInstanceId: appInstances.filter((appInstance) => {
      appInstance.singleAssetTwoPartyCoinTransferInterpreterParams.tokenAddress == params.assetId
    })[0].identityHash };
  }

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (
    assetId: string,
  ): Promise<string> => {
    const token = new Contract(assetId!, tokenAbi, this.ethProvider);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(this.connext.multisigAddress, MinimumViableMultisig.abi, this.ethProvider);
    const startingTotalAmountWithdrawn = multisig
    ? await multisig.functions.totalAmountWithdrawn(assetId)
    : Zero;

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
      startingMultisigBalance
    }

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
