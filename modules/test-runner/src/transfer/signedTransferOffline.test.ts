import {
  env,
  ClientTestMessagingInputOpts,
  createClientWithMessagingLimits,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
  RECEIVED,
  APP_PROTOCOL_TOO_LONG,
  createClient,
  SEND,
  CLIENT_INSTALL_FAILED,
} from "../util";
import {
  toBN,
  getRandomBytes32,
  getTestVerifyingContract,
  getTestReceiptToSign,
  getRandomPrivateKey,
  ChannelSigner,
  signReceiptMessage,
  delay,
} from "@connext/utils";
import {
  IChannelSigner,
  IConnextClient,
  BigNumber,
  ConditionalTransferTypes,
  EventNames,
  EventName,
  ProtocolNames,
  IStoreService,
  PublicParams,
  ProtocolParams,
  PrivateKey,
} from "@connext/types";
import { addressBook } from "@connext/contracts";
import { constants } from "ethers";

const { Zero } = constants;

describe("Signed Transfer Offline", () => {
  const tokenAddress = addressBook[4447].Token.address;
  const addr = addressBook[4447].SimpleSignedTransferApp.address;

  let senderPrivateKey: PrivateKey;
  let senderSigner: IChannelSigner;

  let receiverPrivateKey: PrivateKey;
  let receiverSigner: IChannelSigner;

  beforeEach(async () => {
    senderPrivateKey = getRandomPrivateKey();
    senderSigner = new ChannelSigner(senderPrivateKey, env.ethProviderUrl);

    receiverPrivateKey = getRandomPrivateKey();
    receiverSigner = new ChannelSigner(receiverPrivateKey, env.ethProviderUrl);
  });

  const createAndFundSender = async (
    config: Partial<ClientTestMessagingInputOpts> = {},
  ): Promise<IConnextClient> => {
    const client = await createClientWithMessagingLimits({ ...config, signer: senderSigner });
    await fundChannel(client, TOKEN_AMOUNT, tokenAddress);
    return client;
  };

  // NOTE: will timeout if multisig balance does not change
  const createAndCollateralizeReceiver = async (
    config: Partial<ClientTestMessagingInputOpts> = {},
  ): Promise<IConnextClient> => {
    const client = await createClientWithMessagingLimits({ ...config, signer: receiverSigner });
    await new Promise(async (resolve) => {
      client.on(EventNames.UNINSTALL_EVENT, async (msg) => {
        const freeBalance = await client.getFreeBalance(tokenAddress);
        if (freeBalance[client.nodeSignerAddress].gt(Zero)) {
          resolve();
        }
      });
      await client.requestCollateral(tokenAddress);
    });
    return client;
  };

  const createAndFundClients = async (
    senderConfig: Partial<ClientTestMessagingInputOpts> = {},
    receiverConfig: Partial<ClientTestMessagingInputOpts> = {},
  ): Promise<[IConnextClient, IConnextClient]> => {
    const sender = await createAndFundSender(senderConfig);
    const receiver = await createAndCollateralizeReceiver(receiverConfig);
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
    const receipt = getTestReceiptToSign();
    const { chainId } = await receiver.ethProvider.getNetwork();
    const signature = await signReceiptMessage(
      receipt,
      chainId,
      verifyingContract,
      receiverPrivateKey,
    );
    const attestation = {
      ...receipt,
      signature,
    };
    // node reclaims from sender
    const amount = await new Promise(async (resolve, reject) => {
      // register event listeners
      let unlockedCount = 0;
      receiver.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (msg) => {
        console.log(`receiver got conditional transfer, resolving`);
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
          console.log(`sender got uninstall failed event, rejecting`);
          return reject(new Error(msg.error));
        });
      }
      try {
        await receiver.resolveCondition({
          conditionType: ConditionalTransferTypes.SignedTransfer,
          paymentId,
          attestation,
        } as PublicParams.ResolveSignedTransfer);
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
  ) => {
    const preTransferSenderBalance = await sender.getFreeBalance(tokenAddress);
    const { chainId } = await sender.ethProvider.getNetwork();
    await sender.conditionalTransfer({
      amount,
      paymentId,
      conditionType: ConditionalTransferTypes.SignedTransfer,
      assetId: tokenAddress,
      signerAddress: receiver.signerAddress,
      chainId,
      verifyingContract: getTestVerifyingContract(),
      recipient: receiver.publicIdentifier,
    });
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
    paymentId?: string, // if supplied, will only resolve
  ): Promise<void> => {
    let sender;
    let receiver;
    switch (toRecreate) {
      case "sender": {
        sender = await createClient({ signer, store });
        receiver = counterparty;
        break;
      }
      case "receiver": {
        sender = counterparty;
        receiver = await createClient({ signer, store });
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
    await sender.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

    await recreateClientAndRetryTransfer("sender", receiver, senderSigner, sender.store);
  });

  it("sender proposes transfer successfully, install protocol times out", async () => {
    const senderConfig = {
      ceiling: { [RECEIVED]: 0 },
      protocol: ProtocolNames.install,
      params: { appInterface: { addr } } as ProtocolParams.Install,
    };
    const [sender, receiver] = await createAndFundClients(senderConfig);
    await sendFailingSignedTransfer({
      sender,
      receiver,
      whichFails: "sender",
      error: CLIENT_INSTALL_FAILED(true),
    });
    await sender.off();
    await sender.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

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
    await receiver.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

    await recreateClientAndRetryTransfer(
      "receiver",
      sender,
      receiverSigner,
      receiver.store,
      paymentId,
    );
  });

  it("sender installs transfer successfully, receiver install protocol times out", async () => {
    const receiverConfig = {
      ceiling: { [SEND]: 0, [RECEIVED]: 0 },
      protocol: ProtocolNames.install,
      params: { appInterface: { addr } } as ProtocolParams.Install,
    };
    const [sender, receiver] = await createAndFundClients(undefined, receiverConfig);
    const paymentId = await new Promise<string>(async (resolve, reject) => {
      try {
        const id = await sendSignedTransfer(sender, receiver);
        expect(id).to.be.ok;
        await resolveFailingSignedTransfer({
          sender,
          receiver,
          paymentId: id,
          whichFails: "receiver",
          error: APP_PROTOCOL_TOO_LONG(ProtocolNames.install),
          event: EventNames.INSTALL_FAILED_EVENT,
        });
        resolve(id);
      } catch (err) {
        reject(err);
      }
    });
    await receiver.off();
    await receiver.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

    await recreateClientAndRetryTransfer(
      "receiver",
      sender,
      receiverSigner,
      receiver.store,
      paymentId,
    );
  });

  it("sender + receiver install transfer successfully, receiver take action protocol times out", async () => {
    const receiverConfig = {
      ceiling: { [SEND]: 0 },
      protocol: ProtocolNames.takeAction,
    };
    const [sender, receiver] = await createAndFundClients(undefined, receiverConfig);
    const paymentId = await sendSignedTransfer(sender, receiver);
    expect(paymentId).to.be.ok;
    await resolveFailingSignedTransfer({
      sender,
      receiver,
      paymentId,
      whichFails: "receiver",
      error: APP_PROTOCOL_TOO_LONG(ProtocolNames.takeAction),
      event: EventNames.UPDATE_STATE_FAILED_EVENT,
    });
    await receiver.off();
    await receiver.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

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
    await receiver.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);

    await recreateClientAndRetryTransfer("receiver", sender, receiverSigner, receiver.store);
  });

  // see notes in withdrawal offline tests about take action protocol responders
  // tl;dr need to move this test into the node unit tests
  it.skip("sender install transfer successfully, receiver takes action and uninstalls, sender's take action protocol times out", async () => {});

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
    console.log(`created and funded clients! beginning real test...`);
    const failureEvent = (await new Promise(async (resolve) => {
      sender.once(EventNames.UNINSTALL_FAILED_EVENT, (msg) => {
        return resolve(msg);
      });
      await resolveSignedTransfer(receiver, paymentId);
      console.log(`transfer resolved, waiting for sender failure event`);
    })) as any;
    expect(failureEvent.data.params).to.be.ok;
    expect(failureEvent.data.error).to.include(APP_PROTOCOL_TOO_LONG(ProtocolNames.uninstall));
    console.log(`correctly asserted failure!`);
    // recreate client, node should reclaim
    await sender.messaging.disconnect();
    // Add delay to make sure messaging properly disconnects
    await delay(1000);
    const recreatedSender = await createClient({ signer: senderSigner, store: sender.store });
    const postReclaim = await recreatedSender.getFreeBalance(tokenAddress);
    expect(postReclaim[recreatedSender.nodeSignerAddress]).to.be.greaterThan(
      postTransfer[recreatedSender.nodeSignerAddress],
    );

    await recreateClientAndRetryTransfer("sender", receiver, senderSigner, sender.store, paymentId);
  });
});
