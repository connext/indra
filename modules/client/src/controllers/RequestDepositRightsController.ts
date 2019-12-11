import { Contract } from "ethers";
import { AddressZero, Zero } from "ethers/constants";
import { bigNumberify, getAddress } from "ethers/utils";
import tokenAbi from "human-standard-token-abi";

import { CF_METHOD_TIMEOUT, delayAndThrow, stringify, xpubToAddress } from "../lib";
import {
  BigNumber,
  CFCoreTypes,
  CoinBalanceRefundAppStateBigNumber,
  RejectProposalMessage,
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
    params.assetId = params.assetId || AddressZero;
    const { assetId } = params;
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
    const err = await this.proposeDepositInstall(assetId);
    if (err) {
      throw new Error(err);
    }
    const requestDepositRightsResponse = await this.connext.channelRouter.requestDepositRights(
      assetId,
    );
    this.log.info(
      `requestDepositRightsResponse Response: ${stringify(requestDepositRightsResponse)}`,
    );
    this.log.info(`Deposit rights gained for ${assetId}`);

    const freeBalance = await this.connext.getFreeBalance(assetId);
    this.listener.emit(`indra.client.${this.connext.publicIdentifier}.freeBalanceUpdated`, {
      freeBalance,
    });

    return {
      freeBalance,
      recipient: this.connext.freeBalanceAddress,
      tokenAddress: assetId,
    };
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

    let appId: string;
    try {
      await Promise.race([
        new Promise(async (res: any, rej: any) => {
          boundReject = this.rejectInstallCoinBalance.bind(null, rej);
          this.log.info(
            `subscribing to indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
          );
          await this.connext.messaging.subscribe(
            `indra.node.${this.connext.nodePublicIdentifier}.proposalAccepted.${this.connext.multisigAddress}`,
            res,
          );
          const { appInstanceId } = await this.connext.proposeInstallApp(params);
          appId = appInstanceId;
          this.log.info(`waiting for proposal acceptance of ${appInstanceId}`);
          this.listener.on(
            CFCoreTypes.EventNames.REJECT_INSTALL_EVENT as CFCoreTypes.EventName,
            boundReject,
          );
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
      return e.message;
    } finally {
      this.cleanupInstallListeners(appId, boundReject);
    }
  };

  private rejectInstallCoinBalance = (
    rej: (reason?: string) => void,
    msg: RejectProposalMessage,
  ): void => {
    return rej(`Install failed. Event data: ${stringify(msg)}`);
  };

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
