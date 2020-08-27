/* global before */
import {
  ConditionalTransferCreatedEventData,
  ConditionalTransferTypes,
  EventNames,
  HashLockTransferStatus,
  IConnextClient,
  NodeResponses,
  PublicParams,
} from "@connext/types";
import {
  delay,
  getChainId,
  getRandomBytes32,
  stringify,
} from "@connext/utils";
import { BigNumber, providers, constants, utils } from "ethers";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  ethProviderUrl,
  expect,
  fundChannel,
  getTestLoggers,
  requestCollateral,
  TOKEN_AMOUNT,
} from "../util";

const { AddressZero, HashZero } = constants;
const { soliditySha256 } = utils;

const TIMEOUT_BUFFER = 100; // This currently isn't exported by the node so must be hardcoded

const name = "HashLock Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let provider: providers.JsonRpcProvider;
  let start: number;
  let tokenAddress: string;

  before(async () => {
    start = Date.now();
    provider = new providers.JsonRpcProvider(ethProviderUrl, await getChainId(ethProviderUrl));
    const currBlock = await provider.getBlockNumber();
    if (currBlock > TIMEOUT_BUFFER) {
      // no adjustment needed, return
      return;
    }
    for (let index = currBlock; index <= TIMEOUT_BUFFER + 1; index++) {
      await provider.send("evm_mine", []);
    }
    timeElapsed("beforeEach complete", start);
  });

  // Define helper functions
  const sendHashlockTransfer = async (
    sender: IConnextClient,
    receiver: IConnextClient,
    transfer: AssetOptions & { preImage: string; timelock: string },
  ): Promise<ConditionalTransferCreatedEventData<"HashLockTransferApp">> => {
    // Fund sender channel
    await fundChannel(sender, transfer.amount, transfer.assetId);

    // Create transfer parameters
    const expiry = BigNumber.from(transfer.timelock).add(await provider.getBlockNumber());
    const lockHash = soliditySha256(["bytes32"], [transfer.preImage]);

    // return promise with [sender ret, receiver event data]
    const [senderResult, receiverEvent] = await Promise.all([
      // sender result
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock: transfer.timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      }),
      // receiver created event
      new Promise((resolve) => {
        receiver.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) =>
          resolve(eventPayload),
        );
      }),
    ]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);
    const expectedVals = {
      amount: transfer.amount,
      assetId: transfer.assetId,
      paymentId,
      recipient: receiver.publicIdentifier,
      sender: sender.publicIdentifier,
      transferMeta: {
        timelock: transfer.timelock,
        lockHash,
        expiry: expiry.sub(TIMEOUT_BUFFER),
      },
    };
    // verify the receiver event
    expect(receiverEvent).to.containSubset({
      ...expectedVals,
      type: ConditionalTransferTypes.HashLockTransfer,
    });

    // verify sender return value
    expect(senderResult).to.containSubset({
      ...expectedVals,
      transferMeta: {
        ...expectedVals.transferMeta,
        expiry,
      },
    });
    return receiverEvent as any;
  };

  // returns [resolveResult, undefined, undefined]
  const waitForResolve = (
    sender: IConnextClient,
    receiver: IConnextClient,
    transfer: AssetOptions & { preImage: string; timelock: string },
    waitForSender: boolean = true,
  ) => {
    const lockHash = soliditySha256(["bytes32"], [transfer.preImage]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);
    return Promise.all([
      // receiver result
      receiver.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: transfer.preImage,
        assetId: transfer.assetId,
        paymentId,
      }),
      // receiver event
      new Promise((resolve, reject) => {
        receiver.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
        receiver.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      }),
      // sender event
      new Promise((resolve, reject) => {
        if (waitForSender) {
          sender.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
          sender.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
        } else {
          resolve();
        }
      }),
    ]);
  };

  const assertSenderDecrement = async (
    sender: IConnextClient,
    transfer: AssetOptions & { preImage: string; timelock: string },
  ) => {
    const { [sender.signerAddress]: senderBal } = await sender.getFreeBalance(transfer.assetId);
    expect(senderBal).to.eq(0);
  };

  const assertPostTransferBalances = async (
    sender: IConnextClient,
    receiver: IConnextClient,
    transfer: AssetOptions & { preImage: string; timelock: string },
  ) => {
    const { [sender.signerAddress]: senderBal } = await sender.getFreeBalance(transfer.assetId);
    expect(senderBal).to.eq(0);
    const { [receiver.signerAddress]: receiverBal } = await receiver.getFreeBalance(
      transfer.assetId,
    );
    expect(receiverBal).to.eq(transfer.amount);
  };

  const assertRetrievedTransfer = async (
    client: IConnextClient,
    transfer: AssetOptions & {
      timelock: string;
      preImage: string;
      senderIdentifier: string;
      receiverIdentifier: string;
    },
    expected: Partial<NodeResponses.GetHashLockTransfer> = {},
  ) => {
    const lockHash = soliditySha256(["bytes32"], [transfer.preImage]);
    const retrieved = await client.getHashLockTransfer(lockHash, transfer.assetId);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);
    expect(retrieved).to.containSubset({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: transfer.senderIdentifier,
      receiverIdentifier: transfer.receiverIdentifier,
      meta: {
        sender: transfer.senderIdentifier,
        timelock: transfer.timelock,
        paymentId,
      },
      ...expected,
    });
  };

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
  });

  it("client A hashlock transfers eth to client B through node", async () => {
    const transfer = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    await sendHashlockTransfer(clientA, clientB, opts);

    await assertSenderDecrement(clientA, opts);

    await waitForResolve(clientA, clientB, opts);

    await assertPostTransferBalances(clientA, clientB, opts);
  });

  it("client A hashlock transfers tokens to client B through node", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    await sendHashlockTransfer(clientA, clientB, opts);

    await assertSenderDecrement(clientA, opts);

    await waitForResolve(clientA, clientB, opts);

    await assertPostTransferBalances(clientA, clientB, opts);
  });

  it("transfer is cancelled if receiver is offline", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    await fundChannel(clientA, transfer.amount, transfer.assetId);

    // Create transfer parameters
    const expiry = BigNumber.from(timelock).add(await provider.getBlockNumber());
    const lockHash = soliditySha256(["bytes32"], [preImage]);

    // return promise with [sender ret, receiver event data]
    // sender result
    await clientB.off();
    await expect(
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock: expiry,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      }),
    ).to.be.rejected;

    const fb = await clientA.getFreeBalance(transfer.assetId);
    expect(fb[clientA.signerAddress]).to.eq(transfer.amount);
  });

  it("gets a pending hashlock transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    await sendHashlockTransfer(clientA, clientB, opts);

    await assertRetrievedTransfer(
      clientB,
      {
        ...opts,
        senderIdentifier: clientA.publicIdentifier,
        receiverIdentifier: clientB.publicIdentifier,
      },
      {
        status: HashLockTransferStatus.PENDING,
        preImage: HashZero,
      },
    );
  });

  it("gets a completed hashlock transfer by lock hash", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    await sendHashlockTransfer(clientA, clientB, opts);

    // wait for transfer to be picked up by receiver, but not reclaim
    // by node for sender
    await waitForResolve(clientA, clientB, opts, false);

    await assertRetrievedTransfer(
      clientB,
      {
        ...opts,
        senderIdentifier: clientA.publicIdentifier,
        receiverIdentifier: clientB.publicIdentifier,
      },
      {
        status: HashLockTransferStatus.COMPLETED,
        preImage,
      },
    );
  });

  it("can send two hashlock transfers with different assetIds and the same lock hash", async () => {
    const transferToken = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const transferEth = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const ethOpts = { ...transferEth, preImage, timelock };
    const tokenOpts = { ...transferToken, preImage, timelock };

    await sendHashlockTransfer(clientA, clientB, ethOpts);
    await sendHashlockTransfer(clientA, clientB, tokenOpts);

    await waitForResolve(clientA, clientB, ethOpts);
    await waitForResolve(clientA, clientB, tokenOpts);

    await assertPostTransferBalances(clientA, clientB, ethOpts);
    await assertPostTransferBalances(clientA, clientB, tokenOpts);
  });

  it("cannot resolve a hashlock transfer if pre image is wrong", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    const { paymentId } = await sendHashlockTransfer(clientA, clientB, opts);

    const badPreImage = getRandomBytes32();
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: badPreImage,
        paymentId: paymentId!,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.be.rejectedWith(/Hash generated from preimage does not match hash in state/);

    // verfy payment did not go through
    const { [clientB.signerAddress]: receiverBal } = await clientB.getFreeBalance(transfer.assetId);
    expect(receiverBal).to.eq(0);
  });

  // NOTE: if the node tries to collateralize or send a transaction during
  // this test, it will likely pass due to the 1 block margin of error in the
  // timelock variable
  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (101).toString();
    const opts = { ...transfer, preImage, timelock };

    const { paymentId } = await sendHashlockTransfer(clientA, clientB, opts);

    await new Promise((resolve) => provider.once("block", resolve));
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        paymentId: paymentId!,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.be.rejectedWith(/Cannot take action if expiry is expired/);
  });

  it("cannot install receiver app without sender app installed", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);

    await expect(
      new Promise((res, rej) => {
        // should not see this event, wait 10 seconds to make sure it doesnt happen
        // TODO: change to rej
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, () => {
          rej("Should not get this event!");
        });
        setTimeout(res, 10_000);
      }),
    ).to.be.fulfilled;
  });

  it("receiver should be able to cancel an active payment", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const opts = { ...transfer, preImage, timelock };

    const { paymentId } = await sendHashlockTransfer(clientA, clientB, opts);
    await assertSenderDecrement(clientA, opts);
    const { [clientB.signerAddress]: initialBal } = await clientB.getFreeBalance(transfer.assetId);
    expect(initialBal).to.eq(0);

    await new Promise((resolve, reject) => {
      clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB
        .resolveCondition({
          paymentId: paymentId!,
          preImage: HashZero,
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          assetId: transfer.assetId,
        })
        .catch((e) => reject(e));
    });

    const { [clientA.signerAddress]: senderBal } = await clientA.getFreeBalance(transfer.assetId);
    const { [clientB.signerAddress]: receiverBal } = await clientB.getFreeBalance(transfer.assetId);
    expect(senderBal).to.eq(transfer.amount);
    expect(receiverBal).to.eq(0);
  });

  it("receiver should be able to cancel an expired payment", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (101).toString();
    const opts = { ...transfer, preImage, timelock };

    const { paymentId } = await sendHashlockTransfer(clientA, clientB, opts);
    await assertSenderDecrement(clientA, opts);

    await new Promise((resolve) => provider.on("block", resolve));

    await new Promise((resolve, reject) => {
      clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, resolve);
      clientB
        .resolveCondition({
          paymentId: paymentId!,
          preImage: HashZero,
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          assetId: transfer.assetId,
        })
        .catch((e) => reject(e));
    });

    const { [clientA.signerAddress]: senderBal } = await clientA.getFreeBalance(transfer.assetId);
    const { [clientB.signerAddress]: receiverBal } = await clientB.getFreeBalance(transfer.assetId);
    expect(senderBal).to.eq(transfer.amount);
    expect(receiverBal).to.eq(0);
  });

  it.skip("sender should be able to refund an expired payment", async () => {
    const transfer = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    const preImage = getRandomBytes32();
    const timelock = (1).toString();
    const opts = { ...transfer, preImage, timelock };

    const { paymentId } = await sendHashlockTransfer(clientA, clientB, opts);

    await assertSenderDecrement(clientA, opts);

    // FIXME: how to move blocks successfully?
    // for (const i of Array(parseInt(timelock) + 5)) {
    //   await new Promise((resolve) => provider.once("block", resolve));
    // }

    await assertRetrievedTransfer(
      clientB,
      {
        ...opts,
        senderIdentifier: clientA.publicIdentifier,
        receiverIdentifier: clientB.publicIdentifier,
      },
      {
        status: HashLockTransferStatus.EXPIRED,
        preImage: HashZero,
      },
    );

    await clientA.resolveCondition({
      paymentId: paymentId!,
      preImage: HashZero,
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      assetId: transfer.assetId,
    });

    // make sure payment was reverted in balances
    const { [clientA.signerAddress]: senderBal } = await clientA.getFreeBalance(transfer.assetId);
    const { [clientB.signerAddress]: receiverBal } = await clientB.getFreeBalance(transfer.assetId);
    expect(senderBal).to.eq(transfer.amount);
    expect(receiverBal).to.eq(0);

    // make sure payment says failed on node
    await assertRetrievedTransfer(
      clientB,
      {
        ...opts,
        senderIdentifier: clientA.publicIdentifier,
        receiverIdentifier: clientB.publicIdentifier,
      },
      {
        status: HashLockTransferStatus.FAILED,
        preImage: HashZero,
      },
    );
  });

  // FIXME: may not work depending on collateral, will expect some payment
  // errors even with a small number of payments until this is handled better
  it.skip("can send concurrent hashlock transfers", async () => {
    const transfer = { amount: TOKEN_AMOUNT.div(5), assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount.mul(5), transfer.assetId);
    await fundChannel(clientB, transfer.amount.mul(5), transfer.assetId);
    await requestCollateral(clientA, transfer.assetId, true);
    await requestCollateral(clientB, transfer.assetId, true);

    // add in assertions that will cause the test to fail once these
    // events are thrown
    const registerAssertions = (client: IConnextClient): Promise<void> => {
      return new Promise((resolve, reject) => {
        let reclaimed = 0;
        client.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, (data) => {
          return reject(`${EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT}: ${stringify(data)}`);
        });
        // client.once(EventNames.PROPOSE_INSTALL_FAILED_EVENT, (data) => {
        //   return reject(`${EventNames.PROPOSE_INSTALL_FAILED_EVENT}: ${stringify(data)}`);
        // });
        // client.once(EventNames.INSTALL_FAILED_EVENT, (data) => {
        //   return reject(`${EventNames.INSTALL_FAILED_EVENT}: ${stringify(data)}`);
        // });
        // client.once(EventNames.UNINSTALL_FAILED_EVENT, (data) => {
        //   return reject(`${EventNames.UNINSTALL_FAILED_EVENT}: ${stringify(data)}`);
        // });
        client.once(EventNames.SYNC_FAILED_EVENT, (data) => {
          return reject(`${EventNames.SYNC_FAILED_EVENT}: ${stringify(data)}`);
        });
        client.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, (data) => {
          if (data.sender !== client.publicIdentifier) {
            return;
          }
          reclaimed += 1;
          if (reclaimed === 2) {
            return resolve();
          }
        });
      });
    };
    const a = registerAssertions(clientA);
    const b = registerAssertions(clientB);

    const timelock = (5000).toString();

    let preImage = getRandomBytes32();
    let lockHash = soliditySha256(["bytes32"], [preImage]);

    const t1 = clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);

    preImage = getRandomBytes32();
    lockHash = soliditySha256(["bytes32"], [preImage]);

    const t2 = clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);

    await delay(100);

    preImage = getRandomBytes32();
    lockHash = soliditySha256(["bytes32"], [preImage]);

    const t3 = clientB.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientB.publicIdentifier },
      recipient: clientA.publicIdentifier,
    } as PublicParams.HashLockTransfer);

    preImage = getRandomBytes32();
    lockHash = soliditySha256(["bytes32"], [preImage]);

    const t4 = clientB.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientB.publicIdentifier },
      recipient: clientA.publicIdentifier,
    } as PublicParams.HashLockTransfer);

    const [aRes, bRes] = await Promise.all([a, b, t1, t2, t3, t4]);
    expect(aRes).to.be.undefined;
    expect(bRes).to.be.undefined;

    // await delay(20000);
  });
});
