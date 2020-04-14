import {
  AppInstanceJson,
  DefaultApp,
  DepositAppName,
  DepositAppState,
  EventNames,
  getAddressFromAssetId,
  MethodParams,
  PublicParams,
  PublicResults,
  toBN,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventPayloads,
} from "@connext/types";
import { MinimumViableMultisig } from "@connext/contracts";
import { DEFAULT_APP_TIMEOUT, DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { AbstractController } from "./AbstractController";
import { validate, notLessThanOrEqualTo, notGreaterThan, invalidAddress } from "../validation";

export class DepositController extends AbstractController {
  public deposit = async (params: PublicParams.Deposit): Promise<PublicResults.Deposit> => {
    const amount = toBN(params.amount);
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    validate(invalidAddress(assetId));
    // NOTE: when the `walletDeposit` is not used, these parameters
    // do not have to be validated
    const tokenAddress = getAddressFromAssetId(assetId);
    const startingBalance =
      tokenAddress === AddressZero
        ? await this.ethProvider.getBalance(this.connext.signerAddress)
        : await new Contract(tokenAddress, tokenAbi, this.ethProvider).functions.balanceOf(
            this.connext.signerAddress,
          );
    validate(notLessThanOrEqualTo(amount, startingBalance), notGreaterThan(amount, Zero));
    const { appIdentityHash } = await this.requestDepositRights({ assetId });

    let ret;
    let transactionHash;
    try {
      this.log.debug(`Starting deposit`);
      this.connext.emit(EventNames.DEPOSIT_STARTED_EVENT, {
        amount: amount,
        assetId: tokenAddress,
        appIdentityHash,
      } as EventPayloads.DepositStarted);
      const hash = await this.connext.channelProvider.walletDeposit({
        amount: amount.toString(),
        assetId: tokenAddress,
      });
      this.log.debug(`Sent deposit transaction to chain: ${hash}`);
      transactionHash = hash;
      const tx = await this.ethProvider.getTransaction(hash);
      await tx.wait();
    } catch (e) {
      this.connext.emit(EventNames.DEPOSIT_FAILED_EVENT, {
        amount: amount,
        assetId: tokenAddress,
        error: e.stack || e.message,
      } as EventPayloads.DepositFailed);
      throw new Error(e.stack || e.message);
    } finally {
      ret = await this.rescindDepositRights({ appIdentityHash, assetId });
    }

    if (transactionHash) {
      this.connext.emit(EventNames.DEPOSIT_CONFIRMED_EVENT, {
        hash: transactionHash,
        amount: amount,
        assetId: tokenAddress,
      } as EventPayloads.DepositConfirmed);
    }

    return ret;
  };

  public requestDepositRights = async (
    params: PublicParams.RequestDepositRights,
  ): Promise<PublicResults.RequestDepositRights> => {
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    validate(invalidAddress(assetId));
    const tokenAddress = getAddressFromAssetId(assetId);
    const depositApp = await this.getDepositApp({ assetId: tokenAddress });

    if (!depositApp) {
      this.log.debug(`No deposit app installed for ${assetId}. Installing.`);
      const appIdentityHash = await this.proposeDepositInstall(assetId);
      return {
        appIdentityHash,
        multisigAddress: this.connext.multisigAddress,
      };
    }

    this.log.debug(`Found existing deposit app`);
    const latestState = depositApp.latestState as DepositAppState;

    // check if you are the initiator;
    const initiatorTransfer = latestState.transfers[0];
    if (initiatorTransfer.to !== this.connext.signerAddress) {
      throw new Error(`Node has unfinalized deposit, cannot request deposit rights for ${assetId}`);
    }

    this.log.debug(
      `Found existing, unfinalized deposit app for ${assetId}, doing nothing. (deposit app: ${depositApp.identityHash})`,
    );
    return {
      appIdentityHash: depositApp.identityHash,
      multisigAddress: this.connext.multisigAddress,
    };
  };

  public rescindDepositRights = async (
    params: PublicParams.RescindDepositRights,
  ): Promise<PublicResults.RescindDepositRights> => {
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    validate(invalidAddress(assetId));
    const tokenAddress = getAddressFromAssetId(assetId);
    // get the app instance
    const app = await this.getDepositApp({ assetId: tokenAddress });
    if (!app) {
      this.log.debug(`No deposit app found for assset: ${assetId}`);
      const freeBalance = await this.connext.getFreeBalance(tokenAddress);
      return { freeBalance };
    }

    this.log.debug(`Uninstalling ${app.identityHash}`);
    await this.connext.uninstallApp(app.identityHash);
    this.log.debug(`Uninstalled deposit app`);
    const freeBalance = await this.connext.getFreeBalance(tokenAddress);
    return { freeBalance };
  };

  public getDepositApp = async (
    params: PublicParams.CheckDepositRights,
  ): Promise<AppInstanceJson | undefined> => {
    const appInstances = await this.connext.getAppInstances();
    const depositAppInfo = (await this.connext.getAppRegistry({
      name: DepositAppName,
      chainId: this.ethProvider.network.chainId,
    })) as DefaultApp;
    const depositApp = appInstances.find(
      appInstance =>
        appInstance.appInterface.addr === depositAppInfo.appDefinitionAddress &&
        (appInstance.latestState as DepositAppState).assetId === params.assetId,
    );

    if (!depositApp) {
      return undefined;
    }

    return depositApp;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (assetId: string): Promise<string> => {
    const tokenAddress = getAddressFromAssetId(assetId);

    // generate initial totalAmountWithdrawn
    const multisig = new Contract(
      this.connext.multisigAddress,
      MinimumViableMultisig.abi as any,
      this.ethProvider,
    );

    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.functions.totalAmountWithdrawn(tokenAddress);
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
      tokenAddress === AddressZero
        ? await this.ethProvider.getBalance(this.connext.multisigAddress)
        : await new Contract(tokenAddress, tokenAbi, this.ethProvider).functions.balanceOf(
            this.connext.multisigAddress,
          );

    const initialState: DepositAppState = {
      transfers: [
        {
          amount: Zero,
          to: this.connext.signerAddress,
        },
        {
          amount: Zero,
          to: this.connext.nodeSignerAddress,
        },
      ],
      multisigAddress: this.connext.multisigAddress,
      assetId: tokenAddress,
      startingTotalAmountWithdrawn,
      startingMultisigBalance,
    };

    const network = await this.ethProvider.getNetwork();
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      stateEncoding,
      outcomeType,
    } = await this.connext.getAppRegistry({
      name: DepositAppName,
      chainId: network.chainId,
    }) as DefaultApp;

    const params: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositAssetId: assetId,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: DEPOSIT_STATE_TIMEOUT,
    };

    return await this.proposeAndInstallLedgerApp(params);
  };
}
