import { DEFAULT_APP_TIMEOUT, DEPOSIT_STATE_TIMEOUT } from "@connext/apps";
import { ERC20, MinimumViableMultisig } from "@connext/contracts";
import {
  AppInstanceJson,
  DefaultApp,
  DepositAppName,
  DepositAppState,
  EventNames,
  MethodParams,
  PublicParams,
  PublicResults,
  CONVENTION_FOR_ETH_ASSET_ID,
  EventPayloads,
} from "@connext/types";
import {
  getAddressFromAssetId,
  getAddressError,
  notGreaterThan,
  notLessThanOrEqualTo,
  toBN,
  delayAndThrow,
} from "@connext/utils";
import { BigNumber, Contract, constants } from "ethers";

import { AbstractController } from "./AbstractController";

const { AddressZero, Zero } = constants;

export class DepositController extends AbstractController {
  public deposit = async (params: PublicParams.Deposit): Promise<PublicResults.Deposit> => {
    this.log.info(`deposit started: ${JSON.stringify(params)}`);
    const amount = toBN(params.amount);
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    this.throwIfAny(getAddressError(assetId));
    // NOTE: when the `walletDeposit` is not used, these parameters do not have to be validated
    const tokenAddress = getAddressFromAssetId(assetId);
    this.log.info(`Depositing ${amount.toString()} of ${tokenAddress} into channel`);
    const startingBalance =
      tokenAddress === AddressZero
        ? await this.ethProvider.getBalance(this.connext.signerAddress)
        : await new Contract(tokenAddress, ERC20.abi, this.ethProvider).balanceOf(
            this.connext.signerAddress,
          );
    this.throwIfAny(notLessThanOrEqualTo(amount, startingBalance), notGreaterThan(amount, Zero));
    const { appIdentityHash } = await this.requestDepositRights({ assetId });

    let ret: PublicResults.RescindDepositRights;
    let transactionHash: string;
    try {
      this.log.debug(`Starting deposit`);
      transactionHash = await this.connext.channelProvider.walletDeposit({
        amount: amount.toString(),
        assetId: tokenAddress,
      });
      this.connext.emit(EventNames.DEPOSIT_STARTED_EVENT, {
        amount: amount,
        assetId: tokenAddress,
        appIdentityHash,
        hash: transactionHash,
      });
      this.log.info(`Sent deposit transaction to chain: ${transactionHash}`);
      const tx = await this.ethProvider.getTransaction(transactionHash);
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

    this.log.info(`deposit complete for assetId ${assetId}: ${JSON.stringify(ret)}`);
    return ret;
  };

  public requestDepositRights = async (
    params: PublicParams.RequestDepositRights,
  ): Promise<PublicResults.RequestDepositRights> => {
    this.log.info(`requestDepositRights started: ${JSON.stringify(params)}`);
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    this.throwIfAny(getAddressError(assetId));
    const tokenAddress = getAddressFromAssetId(assetId);
    const depositApp = await this.getDepositApp({ assetId: tokenAddress });

    if (!depositApp) {
      this.log.debug(`No deposit app installed for ${assetId}. Installing.`);
      const appIdentityHash = await this.proposeDepositInstall(assetId);
      this.log.info(`Successfully obtained deposit rights for ${assetId}`);
      return {
        appIdentityHash,
        multisigAddress: this.connext.multisigAddress,
      };
    }

    this.log.debug(`Found existing deposit app: ${depositApp.identityHash}`);
    const latestState = depositApp.latestState as DepositAppState;

    // check if you are the initiator;
    const initiatorTransfer = latestState.transfers[0];
    if (initiatorTransfer.to !== this.connext.signerAddress) {
      this.log.warn(`Found node transfer, waiting 20s to see if app is uninstalled`);
      await Promise.race([
        delayAndThrow(
          20_000,
          `Node has unfinalized deposit, cannot request deposit rights for ${assetId}`,
        ),
        new Promise((resolve) => {
          this.connext.on(EventNames.UNINSTALL_EVENT, (msg) => {
            if (msg.appIdentityHash === depositApp.identityHash) {
              resolve();
            }
          });
        }),
      ]);
      const appIdentityHash = await this.proposeDepositInstall(assetId);
      this.log.info(`Successfully obtained deposit rights for ${assetId}`);
      return {
        appIdentityHash,
        multisigAddress: this.connext.multisigAddress,
      };
    }

    this.log.debug(
      `Found existing, unfinalized deposit app for ${assetId}, doing nothing. (deposit app: ${depositApp.identityHash})`,
    );

    const result: PublicResults.RequestDepositRights = {
      appIdentityHash: depositApp.identityHash,
      multisigAddress: this.connext.multisigAddress,
    };
    this.log.info(
      `requestDepositRights for assetId ${assetId} complete: ${JSON.stringify(result)}`,
    );
    return result;
  };

  public rescindDepositRights = async (
    params: PublicParams.RescindDepositRights,
  ): Promise<PublicResults.RescindDepositRights> => {
    this.log.info(`rescindDepositRights started: ${JSON.stringify(params)}`);
    const assetId = params.assetId
      ? getAddressFromAssetId(params.assetId)
      : CONVENTION_FOR_ETH_ASSET_ID;
    this.throwIfAny(getAddressError(assetId));
    const tokenAddress = getAddressFromAssetId(assetId);
    // get the app instance
    const app = await this.getDepositApp({ assetId: tokenAddress });
    if (!app) {
      this.log.debug(`No deposit app found for assset: ${assetId}`);
      const freeBalance = await this.connext.getFreeBalance(tokenAddress);
      this.log.info(`Successfully rescinded deposit rights for ${assetId}`);
      return { freeBalance };
    }

    this.log.debug(`Uninstalling ${app.identityHash}`);
    await this.connext.uninstallApp(app.identityHash);
    this.log.debug(`Uninstalled deposit app`);
    const freeBalance = await this.connext.getFreeBalance(tokenAddress);
    const result: PublicResults.RescindDepositRights = { freeBalance };
    this.log.info(`rescindDepositRights for assetId ${assetId} complete ${JSON.stringify(result)}`);
    return result;
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
      (appInstance) =>
        appInstance.appDefinition === depositAppInfo.appDefinitionAddress &&
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
      MinimumViableMultisig.abi,
      this.ethProvider,
    );

    let startingTotalAmountWithdrawn: BigNumber;
    try {
      startingTotalAmountWithdrawn = await multisig.totalAmountWithdrawn(tokenAddress);
    } catch (e) {
      const NOT_DEPLOYED_ERR = `CALL_EXCEPTION`;
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
        : await new Contract(tokenAddress, ERC20.abi, this.ethProvider).balanceOf(
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
    } = (await this.connext.getAppRegistry({
      name: DepositAppName,
      chainId: network.chainId,
    })) as DefaultApp;

    const params: MethodParams.ProposeInstall = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: Zero,
      initiatorDepositAssetId: assetId,
      multisigAddress: this.connext.multisigAddress,
      outcomeType,
      responderIdentifier: this.connext.nodeIdentifier,
      responderDeposit: Zero,
      responderDepositAssetId: assetId,
      defaultTimeout: DEFAULT_APP_TIMEOUT,
      stateTimeout: DEPOSIT_STATE_TIMEOUT,
    };

    return this.proposeAndInstallLedgerApp(params);
  };
}
