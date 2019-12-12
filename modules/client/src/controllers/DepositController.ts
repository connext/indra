import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import tokenAbi from "human-standard-token-abi";

import { CF_METHOD_TIMEOUT, delayAndThrow, stringify, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  ChannelState,
  CoinBalanceRefundAppStateBigNumber,
  convert,
  DepositParameters,
  RejectProposalMessage,
  SupportedApplication,
  SupportedApplications,
} from "../types";
import { invalidAddress, notLessThanOrEqualTo, notPositive, validate } from "../validation";

import { AbstractController } from "./AbstractController";

// TODO: refactor to use unrolled version
export class DepositController extends AbstractController {
  public deposit = async (params: DepositParameters): Promise<ChannelState> => {
    const myFreeBalanceAddress = this.connext.freeBalanceAddress;

    const { assetId, amount } = convert.Deposit("bignumber", params);

    // check asset balance of address
    const depositAddr = xpubToAddress(this.connext.publicIdentifier);
    let bal: BigNumber;
    if (assetId === AddressZero) {
      bal = await this.ethProvider.getBalance(depositAddr);
    } else {
      // get token balance
      const token = new Contract(assetId, tokenAbi, this.ethProvider);
      // TODO: correct? how can i use allowance?
      bal = await token.balanceOf(depositAddr);
    }
    validate(
      invalidAddress(assetId),
      notPositive(amount),
      notLessThanOrEqualTo(amount, bal), // cant deposit more than default addr owns
    );

    // TODO: remove free balance stuff?
    const preDepositBalances = await this.connext.getFreeBalance(assetId);

    this.log.info(`\nDepositing ${amount} of ${assetId} into ${this.connext.multisigAddress}\n`);

    // register listeners
    this.log.info("Registering listeners........");
    this.registerListeners();
    this.log.info("Registered!");

    try {
      this.log.info(`Calling ${CFCoreTypes.RpcMethodName.DEPOSIT}`);
      await this.connext.rescindDepositRights({ assetId });
      // propose the app install
      const err = await this.proposeDepositInstall(assetId);
      if (err) {
        throw new Error(err);
      }
      const depositResponse = await this.connext.providerDeposit(amount, assetId);
      this.log.info(`Deposit Response: ${stringify(depositResponse)}`);

      const postDepositBalances = await this.connext.getFreeBalance(assetId);

      const diff = postDepositBalances[myFreeBalanceAddress].sub(
        preDepositBalances[myFreeBalanceAddress],
      );

      // changing this from !eq to lt. now that we have async deposits there is an edge case
      // where it could be more than amount
      if (diff.lt(amount)) {
        throw new Error("My balance was not increased by the deposit amount.");
      }

      this.log.info("Deposited!");
    } catch (e) {
      this.log.error(`Failed to deposit...`);
      this.removeListeners();
      throw e;
    }

    // TODO: fix types!
    return {
      apps: await this.connext.getAppInstances(this.connext.multisigAddress),
      freeBalance: await this.connext.getFreeBalance(assetId),
    } as any;
  };

  /////////////////////////////////
  ////// PRIVATE METHODS

  private proposeDepositInstall = async (assetId: string): Promise<string | undefined> => {
    let boundReject: (msg: RejectProposalMessage) => void;

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
    } = this.connext.getRegisteredAppDetails(
      SupportedApplications.CoinBalanceRefundApp as SupportedApplication,
    );

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

    let appId: string;
    try {
      await Promise.race([
        new Promise(async (res: any, rej: any) => {
          boundReject = this.rejectInstallCoinBalance.bind(null, rej);
          this.log.warn(
            `subscribing to indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
          );
          await this.connext.messaging.subscribe(
            `indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
            res,
          );
          const { appInstanceId } = await this.connext.proposeInstallApp(params);
          appId = appInstanceId;
          this.log.warn(`waiting for proposal acceptance of ${appInstanceId}`);
          this.listener.on(CFCoreTypes.EventNames.REJECT_INSTALL_EVENT, boundReject);
        }),
        delayAndThrow(
          CF_METHOD_TIMEOUT,
          `App install took longer than ${CF_METHOD_TIMEOUT / 1000} seconds`,
        ),
      ]);
      this.log.info(`App was proposed successfully!: ${appId}`);
      return undefined;
    } catch (e) {
      this.log.error(`Error installing app: ${e.toString()}`);
      return e.message();
    } finally {
      this.cleanupInstallListeners(appId, boundReject);
    }
  };

  ////// Listener callbacks
  private depositConfirmedCallback = (data: any): void => {
    this.removeListeners();
  };

  private depositFailedCallback = (data: any): void => {
    this.removeListeners();
  };

  private rejectInstallCoinBalance = (
    rej: (reason?: string) => void,
    msg: RejectProposalMessage,
  ): void => {
    return rej(`Install failed. Event data: ${stringify(msg)}`);
  };

  ////// Listener registration/deregistration
  private registerListeners(): void {
    this.listener.registerCfListener(
      CFCoreTypes.EventNames.DEPOSIT_CONFIRMED_EVENT as CFCoreTypes.EventName,
      this.depositConfirmedCallback,
    );

    this.listener.registerCfListener(
      CFCoreTypes.EventNames.DEPOSIT_FAILED_EVENT as CFCoreTypes.EventName,
      this.depositFailedCallback,
    );
  }

  private removeListeners(): void {
    this.listener.removeCfListener(
      CFCoreTypes.EventNames.DEPOSIT_CONFIRMED_EVENT as CFCoreTypes.EventName,
      this.depositConfirmedCallback,
    );

    this.listener.removeCfListener(
      CFCoreTypes.EventNames.DEPOSIT_FAILED_EVENT as CFCoreTypes.EventName,
      this.depositFailedCallback,
    );
  }

  private cleanupInstallListeners = (appId: string, boundReject: any): void => {
    this.connext.messaging.unsubscribe(
      `indra.node.${this.connext.nodePublicIdentifier}.install.${appId}`,
    );
    this.listener.removeListener(
      CFCoreTypes.EventNames.REJECT_INSTALL_EVENT as CFCoreTypes.EventName,
      boundReject,
    );
  };
}
