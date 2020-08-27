import {
  ConditionalTransferTypes,
  EventName,
  EventNames,
  IChannelSigner,
  IConnextClient,
  IStoreService,
  PrivateKey,
  ProtocolNames,
  ProtocolParams,
  PublicParams,
} from "@connext/types";
import {
  ChannelSigner,
  delay,
  getRandomBytes32,
  getRandomChannelSigner,
  getRandomPrivateKey,
  getTestGraphReceiptToSign,
  getTestVerifyingContract,
  signGraphReceiptMessage,
  toBN,
} from "@connext/utils";
import { BigNumber, constants } from "ethers";

import {
  APP_PROTOCOL_TOO_LONG,
  CLIENT_INSTALL_FAILED,
  ClientTestMessagingInputOpts,
  createClient,
  createClientWithMessagingLimits,
  env,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
  RECEIVED,
  SEND,
  TOKEN_AMOUNT,
} from "../util";

const { Zero } = constants;

const name = "Offline Graph Signed Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let receiverPrivateKey: PrivateKey;
  let receiverSigner: IChannelSigner;
  let senderSigner: IChannelSigner;
  let start: number;

  const tokenAddress = env.contractAddresses[1337].Token.address;
  const addr = env.contractAddresses[1337].GraphSignedTransferApp.address;

  beforeEach(async () => {
    start = Date.now();
    senderSigner = getRandomChannelSigner(ethProviderUrl);
    receiverPrivateKey = getRandomPrivateKey();
    receiverSigner = new ChannelSigner(receiverPrivateKey, ethProviderUrl);
    timeElapsed("beforeEach complete", start);
  });

  const createAndFundClients = async (
    senderConfig: Partial<ClientTestMessagingInputOpts> = {},
    receiverConfig: Partial<ClientTestMessagingInputOpts> = {},
  ): Promise<[IConnextClient, IConnextClient]> => {
    const sender = await createClientWithMessagingLimits({
      ...senderConfig,
      signer: senderSigner,
      id: "sender",
    });
    await fundChannel(sender, TOKEN_AMOUNT, tokenAddress);

    // NOTE: will timeout if multisig balance does not change
    const receiver = await createClientWithMessagingLimits({
      ...receiverConfig,
      signer: receiverSigner,
      id: "receiver",
    });
    await new Promise(async (resolve) => {
      receiver.on(EventNames.UNINSTALL_EVENT, async (msg) => {
        const freeBalance = await receiver.getFreeBalance(tokenAddress);
        if (freeBalance[receiver.nodeSignerAddress].gt(Zero)) {
          resolve();
        }
      });
      await receiver.requestCollateral(tokenAddress);
    });

    return [sender, receiver];
  };

  const resolveSignedTransfer = async (
    receiver: IConnextClient,
    paymentId: string,
    sender?: IConnextClient, // if not supplied, will not wait for reclaim
    resolves: boolean = true,
  ) => {
    const preTransferBalance = await receiver.getFreeBalance(tokenAddress);
    const verifyingContract = getTestVerifyingContract();
    const receipt = getTestGraphReceiptToSign();
    const { chainId } = await receiver.ethProvider.getNetwork();
    const signature = await signGraphReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      receiverPrivateKey,
    );
    // node reclaims from sender
    const amount = await new Promise(async (resolve, reject) => {
      // register event listeners
      let unlockedCount = 0;
      receiver.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (msg) => {
        if (!sender) {
          return resolve(msg.amount);
        }
        unlockedCount++;
        if (sender && unlockedCount === 2) {
          return resolve(msg.amount);
        }
      });
      receiver.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, (msg) => {
        return reject(new Error(msg.error));
      });
      receiver.once(EventNames.PROPOSE_INSTALL_FAILED_EVENT, (msg) => {
        return reject(new Error(msg.error));
      });
      receiver.once(EventNames.INSTALL_FAILED_EVENT, (msg) => {
        return reject(new Error(msg.error));
      });
      receiver.once(EventNames.UPDATE_STATE_FAILED_EVENT, (msg) => {
        return reject(new Error(msg.error));
      });
      receiver.once(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
        return reject(new Error(msg.error));
      });
      if (sender) {
        sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (msg) => {
          unlockedCount++;
          if (sender && unlockedCount === 2) {
            return resolve(msg.amount);
          }
        });
        // add all sender failure events as well
        sender.once(EventNames.UPDATE_STATE_FAILED_EVENT, (msg) => {
          return reject(new Error(msg.error));
        });
        sender.once(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
          return reject(new Error(msg.error));
        });
      }
      try {
        await receiver.resolveCondition({
          conditionType: ConditionalTransferTypes.GraphTransfer,
          paymentId,
          responseCID: receipt.responseCID,
          signature,
        } as PublicParams.ResolveGraphTransfer);
        if (!resolves) {
          return reject(new Error(`Signed transfer successfully resolved`));
        }
      } catch (e) {
        if (resolves) {
          return reject(e);
        }
      }
    });
    const postTransferBalance = await receiver.getFreeBalance(tokenAddress);
    expect(
      postTransferBalance[receiver.signerAddress].sub(preTransferBalance[receiver.signerAddress]),
    ).to.be.eq(amount);
  };

  const sendSignedTransfer = async (
    sender: IConnextClient,
    receiver: IConnextClient,
    amount: BigNumber = toBN(10),
    paymentId: string = getRandomBytes32(),
    waitForReceiverInstall: boolean = true,
  ) => {
    const preTransferSenderBalance = await sender.getFreeBalance(tokenAddress);
    const { chainId } = await sender.ethProvider.getNetwork();
    const receipt = getTestGraphReceiptToSign();
    await sender.conditionalTransfer({
      amount,
      paymentId,
      conditionType: ConditionalTransferTypes.GraphTransfer,
      assetId: tokenAddress,
      signerAddress: receiver.signerAddress,
      chainId,
      verifyingContract: getTestVerifyingContract(),
      requestCID: receipt.requestCID,
      subgraphDeploymentID: receipt.subgraphDeploymentID,
      recipient: receiver.publicIdentifier,
    });
    if (waitForReceiverInstall) {
      await receiver.waitFor(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, 10_000);
    }
    const postTransferSenderBalance = await sender.getFreeBalance(tokenAddress);
    // verify user balance changes
    expect(
      preTransferSenderBalance[sender.signerAddress].sub(
        postTransferSenderBalance[sender.signerAddress],
      ),
    ).to.eq(amount);
    return paymentId;
  };

  const recreateClientAndRetryTransfer = async (
    toRecreate: "sender" | "receiver",
    counterparty: IConnextClient,
    signer: IChannelSigner,
    store: IStoreService,
    paymentId?: string, // if supplied, will resolve
    skipSync?: boolean,
  ): Promise<void> => {
    let sender: IConnextClient | undefined;
    let receiver: IConnextClient;
    switch (toRecreate) {
      case "sender": {
        sender = await createClient({ signer, store, id: "RecreatedSender", skipSync });
        receiver = counterparty;
        break;
      }
      case "receiver": {
        sender = counterparty;
        receiver = await createClient({ signer, store, id: "RecreatedReceiver", skipSync });
        break;
      }
      default: {
        throw new Error(`Invalid client type: ${toRecreate}`);
      }
    }
    if (!paymentId) {
      paymentId = await sendSignedTransfer(sender, receiver);
    }
    await resolveSignedTransfer(receiver, paymentId, sender);
  };

  const sendFailingSignedTransfer = async (opts: {
    sender: IConnextClient;
    receiver: IConnextClient;
    whichFails: "sender" | "receiver";
    error: string;
    event?: EventName;
    amount?: BigNumber;
    paymentId?: string;
  }): Promise<void> => {
    const { sender, receiver, whichFails, error, event, amount, paymentId } = opts;
    if (!event) {
      await expect(
        sendSignedTransfer(sender, receiver, amount, paymentId || getRandomBytes32()),
      ).to.be.rejectedWith(error);
      return;
    }
    const failingClient = whichFails === "sender" ? sender : receiver;
    await new Promise(async (resolve, reject) => {
      failingClient.once(event as any, (msg) => {
        try {
          expect(msg.params).to.be.an("object");
          expect(msg.error).to.include(error);
          return resolve(msg);
        } catch (e) {
          return reject(e.message);
        }
      });

      try {
        await expect(
          sendSignedTransfer(sender, receiver, amount, paymentId || getRandomBytes32()),
        ).to.be.rejectedWith(error);
      } catch (e) {
        return reject(e.message);
      }
    });
  };

  const resolveFailingSignedTransfer = async (opts: {
    sender: IConnextClient;
    receiver: IConnextClient;
    paymentId: string;
    whichFails: "sender" | "receiver";
    error: string;
    event?: EventName;
  }): Promise<void> => {
    const { sender, receiver, whichFails, error, event, paymentId } = opts;
    if (!event) {
      await expect(resolveSignedTransfer(receiver, paymentId, sender)).to.be.rejectedWith(error);
      return;
    }
    const failingClient = whichFails === "sender" ? sender : receiver;
    await new Promise(async (resolve, reject) => {
      failingClient.once(event as any, (msg) => {
        try {
          expect(msg.params).to.be.an("object");
          expect(msg.error).to.include(error);
          return resolve(msg);
        } catch (e) {
          return reject(e.message);
        }
      });

      try {
        await expect(
          resolveSignedTransfer(receiver, paymentId, undefined, false),
        ).to.be.rejectedWith(error);
      } catch (e) {
        return reject(e.message);
      }
    });
  };

  it("sender proposes transfer, protocol times out", async () => {
    const senderConfig = {
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.propose,
      params: { appDefinition: addr },
    };
    const [sender, receiver] = await createAndFundClients(senderConfig);
    await sendFailingSignedTransfer({
      sender,
      receiver,
      whichFails: "sender",
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      event: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    });
    await sender.off();
    await recreateClientAndRetryTransfer("sender", receiver, senderSigner, sender.store);
  });

  it("sender proposes transfer successfully, install protocol times out", async () => {
    const senderConfig = {
      ceiling: { [SEND]: 0, [RECEIVED]: 0 },
      protocol: ProtocolNames.install,
      params: { proposal: { appDefinition: addr } } as ProtocolParams.Install,
    };
    const [sender, receiver] = await createAndFundClients(senderConfig);
    await sendFailingSignedTransfer({
      sender,
      receiver,
      whichFails: "sender",
      error: CLIENT_INSTALL_FAILED(true),
    });
    await sender.off();
    await recreateClientAndRetryTransfer("sender", receiver, senderSigner, sender.store);
  });

  // TODO: WTF -- maybe same issues as take action, but even if in this case
  // the node endpoint `resolve-signed` should fail.
  it.skip("sender installs transfer successfully, receiver propose protocol times out", async () => {
    const receiverConfig = {
      ceiling: { [RECEIVED]: 0 },
      protocol: ProtocolNames.propose,
      params: { appDefinition: addr },
    };
    const [sender, receiver] = await createAndFundClients(undefined, receiverConfig);
    const paymentId = await sendSignedTransfer(sender, receiver);
    expect(paymentId).to.be.ok;
    await resolveFailingSignedTransfer({
      sender,
      receiver,
      paymentId,
      whichFails: "receiver",
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.propose),
      event: EventNames.PROPOSE_INSTALL_FAILED_EVENT,
    });
    await receiver.off();
    await recreateClientAndRetryTransfer(
      "receiver",
      sender,
      receiverSigner,
      receiver.store,
      paymentId,
    );
  });

  it("sender + receiver install transfer successfully, receiver takes action, receiver uninstall protocol times out", async () => {
    const receiverConfig = {
      ceiling: { [RECEIVED]: 2 }, // collateral
      protocol: ProtocolNames.uninstall,
    };
    const [sender, receiver] = await createAndFundClients(undefined, receiverConfig);
    const paymentId = await sendSignedTransfer(sender, receiver);
    expect(paymentId).to.be.ok;
    await resolveFailingSignedTransfer({
      sender,
      receiver,
      paymentId,
      whichFails: "receiver",
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.uninstall),
      event: EventNames.UNINSTALL_FAILED_EVENT,
    });
    await receiver.off();
    await recreateClientAndRetryTransfer("receiver", sender, receiverSigner, receiver.store);
  });

  // see notes in withdrawal offline tests about take action protocol responders
  // tl;dr need to move this test into the node unit tests (same thing happens
  // for uninstall responders)
  it.skip("sender install transfer successfully, receiver takes action and uninstalls, sender's uninstall protocol times out", async () => {
    const senderConfig = {
      ceiling: { [SEND]: 3 }, // deposit, collateral, payment
      protocol: ProtocolNames.uninstall,
    };
    const [sender, receiver] = await createAndFundClients(senderConfig);
    const paymentId = await sendSignedTransfer(sender, receiver);
    const postTransfer = await sender.getFreeBalance(tokenAddress);
    expect(paymentId).to.be.ok;
    const failureEvent = (await new Promise(async (resolve) => {
      sender.once(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
        return resolve(msg);
      });
      await resolveSignedTransfer(receiver, paymentId);
    })) as any;
    expect(failureEvent.data.params).to.be.ok;
    expect(failureEvent.data.error).to.include(APP_PROTOCOL_TOO_LONG(ProtocolNames.uninstall));
    // recreate client, node should reclaim
    await sender.off();
    const recreatedSender = await createClient({ signer: senderSigner, store: sender.store });
    const postReclaim = await recreatedSender.getFreeBalance(tokenAddress);
    expect(postReclaim[recreatedSender.nodeSignerAddress]).to.be.greaterThan(
      postTransfer[recreatedSender.nodeSignerAddress],
    );
    await recreateClientAndRetryTransfer("sender", receiver, senderSigner, sender.store, paymentId);
  });
});
