import { NatsMessagingService } from "@connext/messaging";
import {
  ResolveLinkedTransferResponse,
  SimpleLinkedTransferAppStateBigNumber,
  SupportedApplications,
} from "@connext/types";
import { AppInstanceJson, Node as CFCoreTypes } from "@counterfactual/types";
import { Inject, Injectable } from "@nestjs/common";
import { Zero } from "ethers/constants";
import { BigNumber } from "ethers/utils";

import { AppRegistry } from "../appRegistry/appRegistry.entity";
import { AppRegistryRepository } from "../appRegistry/appRegistry.repository";
import { CFCoreService } from "../cfCore/cfCore.service";
import { ChannelRepository } from "../channel/channel.repository";
import { ChannelService } from "../channel/channel.service";
import { ConfigService, DefaultApp } from "../config/config.service";
import { MessagingProviderId, Network } from "../constants";
import { mkHash } from "../test";
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
    @Inject(MessagingProviderId) private readonly messagingProvider: NatsMessagingService,
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
    logger.debug(
      `Resolving linked transfer with userPubId: ${userPubId}, paymentId: ${paymentId}, ` +
        `preImage: ${preImage}, amount: ${amount}, assetId: ${assetId}`,
    );
    const channel = await this.channelRepository.findByUserPublicIdentifier(userPubId);
    if (!channel) {
      throw new Error(`No channel exists for userPubId ${userPubId}`);
    }

    const linkedHash = createLinkedHash(amount, assetId, paymentId, preImage);

    // check that we have recorded this transfer in our db
    const transfer = await this.linkedTransferRepository.findByLinkedHash(linkedHash);
    if (!transfer) {
      throw new Error(`No transfer exists for linkedHash ${linkedHash}`);
    }
    if (transfer.status === LinkedTransferStatus.REDEEMED) {
      throw new Error(`Transfer with linkedHash ${linkedHash} has already been redeemed`);
    }
    logger.debug(`Found linked transfer in our database, attempting to resolve...`);

    // check that linked transfer app has been installed from sender
    const defaultApp = (await this.configService.getDefaultApps()).find(
      (app: DefaultApp) => app.name === SupportedApplications.SimpleLinkedTransferApp,
    );
    const installedApps = await this.cfCoreService.getAppInstances();
    const senderApp = installedApps.find(
      (app: AppInstanceJson) =>
        app.appInterface.addr === defaultApp.appDefinitionAddress &&
        (app.latestState as SimpleLinkedTransferAppStateBigNumber).linkedHash === linkedHash,
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
      SupportedApplications.SimpleLinkedTransferApp,
      network.name as Network,
    );

    const initialState: SimpleLinkedTransferAppStateBigNumber = {
      amount,
      assetId,
      coinTransfers: [
        {
          amount,
          to: freeBalanceAddressFromXpub(this.cfCoreService.cfCore.publicIdentifier),
        },
        {
          amount: Zero,
          to: freeBalanceAddressFromXpub(userPubId),
        },
      ],
      linkedHash,
      paymentId,
      preImage: mkHash("0x0"),
    };

    let receiverApp: LinkedTransfer;
    await new Promise(
      async (resolve: any): Promise<void> => {
        this.messagingProvider.subscribe(`indra.client.install.${userPubId}`, (data: any) => {
          console.log("RECEIVED CLIENT INSTALL EVENT: ", data);
          resolve();
        });

        receiverApp = await this.installLinkedTransferApp(
          userPubId,
          initialState,
          mkHash("0x0"),
          paymentId,
          transfer,
          appInfo,
        );
      },
    );

    await this.takeActionAndUninstallLink(receiverApp.receiverAppInstanceId, preImage);

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
    }

    this.linkedTransferRepository.markAsRedeemed(transfer, channel);

    // uninstall sender app
    // dont await so caller isnt blocked by this
    // TODO: if sender is offline, this will fail
    this.takeActionAndUninstallLink(senderApp.identityHash, preImage)
      .then(() => {
        this.linkedTransferRepository.markAsReclaimed(transfer);
      })
      .catch(logger.error);

    return {
      freeBalance: await this.cfCoreService.getFreeBalance(
        userPubId,
        channel.multisigAddress,
        assetId,
      ),
      paymentId,
    };
  }

  async takeActionAndUninstallLink(appId: string, preImage: string): Promise<void> {
    // TODO: TESTING IF THIS IS METHOD IS THROWN TO SEE IF WE NEED TO WAIT ON IT
    this.cfCoreService.cfCore.on(CFCoreTypes.RpcMethodName.TAKE_ACTION, (data: any) => {
      console.log("RECEIVED CF NODE TAKE ACTION EVENT: ", data);
    });

    console.log(`Taking action on app at ${Date.now()}`);
    await this.cfCoreService.takeAction(appId, { preImage });

    try {
      await this.cfCoreService.uninstallApp(appId);
    } catch (e) {
      throw new Error(`finalizeAndUninstallTransferApp: ${e}`);
    }
  }

  async installLinkedTransferApp(
    userPubId: string,
    initialState: SimpleLinkedTransferAppStateBigNumber,
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

  async uninstallLinkedTransferApp(appInstanceId: string): Promise<void> {
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
