import { 
  MethodParams,
  DepositParameters,
  DepositResponse,
  RequestDepositRightsParameters,
  RequestDepositRightsResponse,
  RescindDepositRightsResponse,
  RescindDepositRightsParameters,
  CheckDepositRightsParameters,
  MIN_DEPOSIT_TIMEOOUT_BLOCKS,
  AppInstanceJson,
  DepositAppAction,
  toBN,
  bigNumberifyJson,
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
    if (toBN(latestState.timelock).lt(await this.ethProvider.getBlockNumber())) {
      throw new Error(`Found existing deposit app with expired timelock, please call "rescindDepositRights" for ${assetId}`);
    }

    // if the timelock has not expired, but the state is finalized, uninstall
    if (latestState.finalized) {
      throw new Error(`Found existing deposit app with finalized state, please call "rescindDepositRights" for ${assetId}`);
    }

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
    const { assetId } = params;
    // get the app instance
    const app = await this.getDepositApp({ assetId: assetId || AddressZero });
    if (!app) {
      throw new Error(`No deposit app found for assset: ${assetId || AddressZero}`);
    }

    const uninstallGetFreeBalance = async () => {
      // state has expired, uninstall
      await this.connext.uninstallApp(app.identityHash);
      const freeBalance = await this.connext.getFreeBalance(assetId || AddressZero);
      return { freeBalance };
    };

    const latestState = bigNumberifyJson(app.latestState) as DepositAppState;
    // if the timelock has expired, uninstall the app regardless
    // if you are the initiator, or if the state is finalized
    if (toBN(latestState.timelock).lt(await this.ethProvider.getBlockNumber())) {
      this.log.debug(`Deposit app timelock expired, uninstalling`);
      return uninstallGetFreeBalance();
    }

    // if the timelock has not expired, but the state is finalized, uninstall
    if (latestState.finalized) {
      this.log.debug(`Deposit app state is finalized, uninstalling`);
      return uninstallGetFreeBalance();
    }

    // check if you are the initiator;
    const initiatorTransfer = latestState.transfers[0];
    if (initiatorTransfer.to !== this.connext.freeBalanceAddress) {
      throw new Error(`Node has unfinalized deposit, cannot rescind rights for ${assetId || AddressZero}`);
    }

    // make sure the deposit has gone through
    // NOTE: this function has no context into the *amount* that was deposited
    // this is fine, because the node can always leave the users deposit app
    // installed, then collateralize/pay the user by sending funds directly
    // to the multisig
    const token = new Contract(assetId!, tokenAbi, this.ethProvider);
    const endingMultisigBalance =
      assetId === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await token.functions.balanceOf(this.connext.multisigAddress);

    if (endingMultisigBalance.lte(latestState.startingMultisigBalance)) {
      throw new Error(`Deposit has not yet completed, cannot rescind deposit rights`);
    }

    // first take action to finalize the state
    this.log.debug(`Taking action to finalize deposit app ${app.identityHash}`);
    const action: DepositAppAction = {};
    await this.connext.takeAction(app.identityHash, action);
  
    this.log.debug(`Deposit app finalized, uninstalling ${app.identityHash}`);
    return uninstallGetFreeBalance();
  }

  public getDepositApp = async (
    params: CheckDepositRightsParameters,
  ): Promise<AppInstanceJson | undefined> => {
    const appInstances = await this.connext.getAppInstances();
    const depositApp = appInstances.filter(
      (appInstance) => 
        appInstance
          .singleAssetTwoPartyCoinTransferInterpreterParams
          .tokenAddress === params.assetId,
    )[0];

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
