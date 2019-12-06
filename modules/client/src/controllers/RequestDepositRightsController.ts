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
  SupportedApplications,
} from "../types";
import { invalidAddress, notNegative, validate } from "../validation";

import { AbstractController } from "./AbstractController";

export class RequestDepositRightsController extends AbstractController {
  public requestDepositRights = async (
    params: RequestDepositRightsParameters,
  ): Promise<CFCoreTypes.RequestDepositRightsResult> => {
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

    // this.registerListeners(assetId);

    const existingBalanceRefundApp = await this.connext.getBalanceRefundApp(assetId);
    if (existingBalanceRefundApp) {
      if (
        bigNumberify(existingBalanceRefundApp.latestState["threshold"]).eq(multisigBalance) &&
        existingBalanceRefundApp.latestState["recipient"] === this.connext.freeBalanceAddress
      ) {
        this.log.info(
          `Balance refund app for ${assetId} is in the correct state, doing nothing`,
        );
        return {
          freeBalance: await this.connext.getFreeBalance(assetId),
          recipient: this.connext.freeBalanceAddress,
          tokenAddress: assetId,
        };
      }
      this.log.info(`Balance refund app is not in the correct state, uninstalling first`);
      await this.connext.rescindDepositRights(assetId);
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

  private registerListeners = (assetId: string = AddressZero): void => {
    if (assetId === AddressZero) {
      // register listener for eth
      // listener on ETH transfers to multisig to uninstall balance refund
      // for eth
      // FIXME: race condition? hub collateralizes with eth and rights
      // are rescinded before client deposits?
      this.ethProvider.on(this.connext.multisigAddress, async (balance: BigNumber) => {
        this.log.info(`Got a transfer to multisig. balance: ${balance}`);
        // reinstall balance refund app for ETH
        if (balance.isZero()) {
          this.log.info(`Multisig transfer has 0 balance, not uninstalling`);
          return;
        }
        await this.connext.rescindDepositRights(AddressZero);
        const freeBalance = await this.connext.getFreeBalance(AddressZero);
        this.log.info(`updated FreeBalance: ${stringify(freeBalance)}`);
      });
    } else {
      // listener on token transfers to multisig to uninstall balance refuns
      // this is because in the case that the counterparty deposits in their
      // channel, we want to minimize the amount of time the balance token
      // refund app is installed on the client. this will allow the deposit to
      // be shown immediately upon transfer
      this.connext.token.on("Transfer", async (src: string, dst: string, wad: string) => {
        if (getAddress(dst) !== this.connext.multisigAddress) {
          // not our multisig
          return;
        }
        this.log.info(`Got a transfer to multisig. src: ${src}, dst: ${dst}, wad: ${wad}`);
        // uninstall balance refund app for token
        if (getAddress(src) === xpubToAddress(this.connext.nodePublicIdentifier)) {
          // transfer is from node, dont uninstall refund app
          this.log.info(`Transfer from node, not uninstalling balance refund app`);
          return;
        }
        this.log.info(`Uninstalling balance refund app`);
        await this.connext.rescindDepositRights(this.connext.config.contractAddresses.Token);
        const freeBalance = await this.connext.getFreeBalance(
          this.connext.config.contractAddresses.Token,
        );
        this.log.info(`updated FreeBalance: ${stringify(freeBalance)}`);
      });
    }
  };

  private cleanupListeners = (assetId: string = AddressZero): void => {
    if (assetId === AddressZero) {
      this.log.info(`Removing all eth provider listeners for multisig`);
      this.ethProvider.removeAllListeners(this.connext.multisigAddress);
    } else {
      this.log.info(`Removing all token transfer listeners`);
      this.connext.token.removeAllListeners("Transfer");
    }
  };

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
          this.listener.on(CFCoreTypes.EventName.REJECT_INSTALL, boundReject);
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
    this.listener.removeListener(CFCoreTypes.EventName.REJECT_INSTALL_VIRTUAL, boundReject);
  };
}
