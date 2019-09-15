import {
  ConditionalTransferInitialStateBigNumber,
  ResolveLinkedTransferResponse,
  SupportedApplications,
  UnidirectionalLinkedTransferAppActionBigNumber,
  UnidirectionalLinkedTransferAppStage,
  UnidirectionalLinkedTransferAppStateBigNumber,
} from "@connext/types";
import { AppInstanceJson, Node as CFCoreTypes } from "@counterfactual/types";
import { Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService } from "../config/config.service";
import { Network } from "../constants";
import { CFCoreService } from "../cfCore/cfCore.service";
import { CLogger, createLinkedHash, delay, freeBalanceAddressFromXpub, replaceBN } from "../util";

import {
  LinkedTransfer,
  LinkedTransferStatus,
  PeerToPeerTransfer,
  PeerToPeerTransferStatus,
} from "./transfer.entity";
import { LinkedTransferRepository, PeerToPeerTransferRepository } from "./transfer.repository";

const logger = new CLogger("TransferService");
const maxRetries = 20;
const delayMs = 250;

@Injectable()
export class TransferService {
  appId: string;

  constructor(
    private readonly cfCoreService: CFCoreService,
    private readonly channelService: ChannelService,
    private readonly configService: ConfigService,
    private readonly channelRepository: ChannelRepository,
    private readonly appRegistryRepository: AppRegistryRepository,
    private readonly p2pTransferRepository: PeerToPeerTransferRepository,
    private readonly linkedTransferRepository: LinkedTransferRepository,
  ) {}

  async savePeerToPeerTransfer(
    senderPubId: string,
    receiverPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
  ): Promise<PeerToPeerTransfer> {
    const transfer = new PeerToPeerTransfer();
    transfer.amount = amount;
    transfer.appInstanceId = appInstanceId;
    transfer.assetId = assetId;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    transfer.senderChannel = senderChannel;

    const receiverChannel = await this.channelRepository.findByUserPublicIdentifier(receiverPubId);
    transfer.receiverChannel = receiverChannel;
    transfer.status = PeerToPeerTransferStatus.PENDING;

    return await this.p2pTransferRepository.save(transfer);
  }

  async saveLinkedTransfer(
    senderPubId: string,
    assetId: string,
    amount: BigNumber,
    appInstanceId: string,
    linkedHash: string,
  ): Promise<LinkedTransfer> {
    const transfer = new LinkedTransfer();
    transfer.senderAppInstanceId = appInstanceId;
    transfer.amount = amount;
    transfer.assetId = assetId;
    transfer.linkedHash = linkedHash;

    const senderChannel = await this.channelRepository.findByUserPublicIdentifier(senderPubId);
    transfer.senderChannel = senderChannel;

    transfer.status = LinkedTransferStatus.PENDING;

    return await this.linkedTransferRepository.save(transfer);
  }

  async resolveLinkedTransfer(
    userPubId: string,
    paymentId: string,
    preImage: string,
    amount: BigNumber,
    assetId: string,
  ): Promise<ResolveLinkedTransferResponse> {
    logger.log(
      `Resolving linked transfer with userPubId: ${userPubId}, paymentId: ${paymentId}, ` +
        `preImage: ${preImage}, amount: ${amount}, assetId: ${assetId}`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPubId}`);
    }

    const linkedHash = createLinkedHash({ amount, assetId, paymentId, preImage });

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByLinkedHash(linkedHash);
    if (!transfer) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }
    if (transfer.status === LinkedTransferStatus.REDEEMED) {
      throw new Error(`Transfer with linkedHash ${linkedHash} has already been redeemed`);
    }

    // check that linked transfer app has been installed from sender
    const installedApps = await this.cfCoreService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        (app.latestState as UnidirectionalLinkedTransferAppStateBigNumber).linkedHash ===
        linkedHash,
    );
    if (!senderApp) {
      throw new Error(`App with provided hash has not been installed: ${linkedHash}`);
    }

    const freeBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );
    const preTransferBal =
      freeBal[freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier)];

    await this.channelService.requestCollateral(userPubId, assetId, amount);

    const network = await this.configService.getEthNetwork();
    const appInfo = await this.appRegistryRepository.findByNameAndNetwork(
      SupportedApplications.UnidirectionalLinkedTransferApp,
      network.name as Network,
    );

    const initialState: UnidirectionalLinkedTransferAppStateBigNumber = {
      finalized: false,
      linkedHash,
      stage: UnidirectionalLinkedTransferAppStage.POST_FUND,
      transfers: [
        {
          amount: Zero,
          to: freeBalanceAddressFromXpub(userPubId),
        },
        {
          amount,
          to: freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier),
        },
      ],
      turnNum: Zero,
    };

    const receiverApp = await this.installLinkedTransferApp(
      userPubId,
      initialState,
      preImage,
      paymentId,
      transfer,
      appInfo,
    );

    // TODO: why do we have to do this?
    try {
      await this.waitForAppInstall(receiverApp.receiverAppInstanceId);
    } catch (e) {
      throw new Error(`waitForAppInstall: ${e}`);
    }

    try {
      await this.finalizeAndUninstallTransferApp(receiverApp.receiverAppInstanceId, transfer);
    } catch (e) {
      throw new Error(`finalizeAndUninstallTransferApp: ${e}`);
    }

    // pre - post = amount
    // sanity check, free balance decreased by payment amount
    const postTransferBal = await this.cfCoreService.getFreeBalance(
      userPubId,
      channel.multisigAddress,
      assetId,
    );

    const diff = preTransferBal.sub(
      postTransferBal[freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier)],
    );

    if (!diff.eq(amount)) {
      logger.warn(`Got an unexpected difference of free balances before and after uninstalling`);
      logger.warn(
        `preTransferBal: ${preTransferBal.toString()}, postTransferBalance: ${postTransferBal[
          freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier)
        ].toString()}, expected ${amount.toString()}`,
      );
    } else if (
      postTransferBal[freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier)].lte(
        preTransferBal,
      )
    ) {
      logger.warn("Free balance after transfer is lte free balance before transfer..");
      logger.warn(
        `preTransferBal: ${preTransferBal.toString()}, postTransferBalance: ${postTransferBal[
          freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier)
        ].toString()}, expected ${amount.toString()}`,
      );
    }

    this.linkedTransferRepository.markAsRedeemed(transfer, channel);

    // uninstall sender app
    // dont await so caller isnt blocked by this
    // TODO: if sender is offline, this will fail
    this.finalizeAndUninstallTransferApp(senderApp.identityHash, transfer).catch(logger.error);

    return {
      freeBalance: await this.cfCoreService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  async installLinkedTransferApp(
    userPubId: string,
    initialState: ConditionalTransferInitialStateBigNumber,
    preImage: string,
    paymentId: string,
    transfer: LinkedTransfer,
    appInfo: AppRegistry,
  ): Promise<LinkedTransfer> {
    // note: intermediary is added in connext.ts as well
    const {
      actionEncoding,
      appDefinitionAddress: appDefinition,
      outcomeType,
      stateEncoding,
    } = appInfo;
    const params: CFCoreTypes.ProposeInstallParams = {
      abiEncodings: {
        actionEncoding,
        stateEncoding,
      },
      appDefinition,
      initialState,
      initiatorDeposit: transfer.amount,
      initiatorDepositTokenAddress: transfer.assetId,
      outcomeType,
      proposedToIdentifier: userPubId,
      responderDeposit: Zero,
      responderDepositTokenAddress: transfer.assetId,
      timeout: Zero,
    };

    const res = await this.cfCoreService.proposeInstallApp(params);

    // add preimage to database to allow unlock from a listener
    transfer.receiverAppInstanceId = res.appInstanceId;
    transfer.preImage = preImage;
    transfer.paymentId = paymentId;
    return await this.linkedTransferRepository.save(transfer);

    // app will be finalized and uninstalled by the install listener in listener service
  }

  async finalizeAndUninstallTransferApp(
    appInstanceId: string,
    transfer: LinkedTransfer,
  ): Promise<void> {
    const { amount, assetId, paymentId, preImage } = transfer;
    // display initial state of app
    const preActionApp = await this.cfCoreService.getAppState(appInstanceId);

    // NOTE: was getting an error here, printing this in case it happens again
    logger.log(`appInstanceId: ${appInstanceId}`);
    logger.log(`preAction appInfo: ${JSON.stringify(preActionApp, replaceBN, 2)}`);
    logger.log(
      `preAction appInfo.transfers: ${JSON.stringify(
        (preActionApp.state as any).transfers,
        replaceBN,
        2,
      )}`,
    );
    const action: UnidirectionalLinkedTransferAppActionBigNumber = {
      amount,
      assetId,
      paymentId,
      preImage,
    };

    try {
      await this.cfCoreService.takeAction(appInstanceId, action);
    } catch (e) {
      throw new Error(`cfCoreService.takeAction: ${e}`);
    }

    try {
      await this.waitForFinalize(appInstanceId);
    } catch (e) {
      logger.error(`waitForFinalize: ${e}`);
    }

    // display final state of app
    const appInfo = await this.cfCoreService.getAppState(appInstanceId);

    // NOTE: was getting an error here, printing this in case it happens again
    logger.log(`postAction appInfo: ${JSON.stringify(appInfo, replaceBN, 2)}`);
    // NOTE: sometimes transfers is a nested array, and sometimes its an
    // array of objects. super bizzarre, but is what would contribute to errors
    // with logging and casting.... :shrug:
    logger.log(
      `postAction appInfo.transfers: ${JSON.stringify(
        (appInfo.state as any).transfers,
        replaceBN,
        2,
      )}`,
    );

    await this.cfCoreService.uninstallApp(appInstanceId);

    // adding a promise for now that polls app instances, but its not
    // great and should be removed
    try {
      await this.waitForAppUninstall(appInstanceId);
    } catch (e) {
      throw e;
    }
  }

  async waitForAppInstall(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.cfCoreService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 1;
        while (!(await getAppIds()).includes(appInstanceId)) {
          logger.log(`App ${appInstanceId} is not installed yet... retry number ${retries}...`);
          await delay(delayMs);
          retries = retries + 1;
          if (retries > maxRetries) {
            return rej(`Timed out waiting for app ${appInstanceId} to install`);
          }
        }
        logger.log(`App ${appInstanceId} installed after ${(retries * delayMs) / 1000}s`);
        res(this.appId);
      },
    );
  }

  private waitForFinalize(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const isFinalized = async (): Promise<boolean> => {
          const appInfo = await this.cfCoreService.getAppState(appInstanceId);
          const appState = appInfo.state as UnidirectionalLinkedTransferAppStateBigNumber;
          return appState.finalized;
        };
        let retries = 1;
        while (!(await isFinalized())) {
          logger.log(`Transfer has not been finalized... retry number ${retries}...`);
          await delay(delayMs);
          retries = retries + 1;
          if (retries > maxRetries) {
            return rej(`Timed out waiting for app ${appInstanceId} to finalize`);
          }
        }
        logger.log(`App ${appInstanceId} finalized after ${(retries * delayMs) / 1000}s`);
        res(this.appId);
      },
    );
  }

  private waitForAppUninstall(appInstanceId: string): Promise<unknown> {
    return new Promise(
      async (res: (value?: unknown) => void, rej: (reason?: any) => void): Promise<void> => {
        const getAppIds = async (): Promise<string[]> => {
          return (await this.cfCoreService.getAppInstances()).map(
            (a: AppInstanceJson) => a.identityHash,
          );
        };
        let retries = 0;
        while ((await getAppIds()).indexOf(appInstanceId) !== -1) {
          logger.log(`App ${appInstanceId} is not uninstalled yet... retry number ${retries}...`);
          await delay(delayMs);
          retries = retries + 1;
          if (retries > maxRetries) {
            return rej(`Timed out waiting for app ${appInstanceId} to uninstall`);
          }
        }
        logger.log(`App ${appInstanceId} uninstalled after ${(retries * delayMs) / 1000}s`);
        res();
      },
    );
  }
}
