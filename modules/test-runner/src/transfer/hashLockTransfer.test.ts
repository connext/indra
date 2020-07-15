/* global before */
import {
  ConditionalTransferTypes,
  EventNames,
  HashLockTransferStatus,
  IConnextClient,
  NodeResponses,
  PublicParams,
  EventPayloads,
  UnlockedHashLockTransferMeta,
  ConditionalTransferCreatedEventData,
} from "@connext/types";
import { getRandomBytes32, getChainId, delay, stringify } from "@connext/utils";
import { BigNumber, providers, constants, utils } from "ethers";

import {
  AssetOptions,
  createClient,
  ETH_AMOUNT_SM,
  expect,
  fundChannel,
  TOKEN_AMOUNT,
  env,
  requestCollateral,
} from "../util";

const { AddressZero, HashZero } = constants;
const { soliditySha256 } = utils;

describe("HashLock Transfers", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let provider: providers.JsonRpcProvider;

  before(async () => {
    provider = new providers.JsonRpcProvider(
      env.ethProviderUrl,
      await getChainId(env.ethProviderUrl),
    );
    const currBlock = await provider.getBlockNumber();
    // the node uses a `TIMEOUT_BUFFER` on recipient of 100 blocks
    // so make sure the current block
    const TIMEOUT_BUFFER = 100;
    if (currBlock > TIMEOUT_BUFFER) {
      // no adjustment needed, return
      return;
    }
    for (let index = currBlock; index <= TIMEOUT_BUFFER + 1; index++) {
      await provider.send("evm_mine", []);
    }
  });

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses.Token!;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: client A hashlock transfers eth to client B through node", async () => {
    const transfer: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(timelock).add(await provider.getBlockNumber());

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    await Promise.all([
      new Promise((res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
          expect(eventPayload).to.deep.contain({
            amount: transfer.amount,
            assetId: transfer.assetId,
            type: ConditionalTransferTypes.HashLockTransfer,
            paymentId: lockHash,
            recipient: clientB.publicIdentifier,
          } as EventPayloads.HashLockTransferCreated);
          expect(eventPayload.transferMeta).to.deep.eq({
            timelock,
            lockHash,
            expiry: expiry.sub(100),
          });
          return res();
        });
      }),
      // new Promise((reso) => {
      //   clientA.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
      //     console.log("clientAeventPayload: ", eventPayload);
      //     expect(eventPayload).to.deep.contain({
      //       amount: transfer.amount,
      //       assetId: transfer.assetId,
      //       type: ConditionalTransferTypes.HashLockTransfer,
      //       paymentId: lockHash,
      //       recipient: clientB.publicIdentifier,
      //     } as EventPayloads.HashLockTransferCreated);
      //     expect(eventPayload.transferMeta).to.deep.eq({
      //       timelock,
      //       lockHash,
      //       expiry,
      //     });
      //     console.log("RESOLVING A");
      //     return reso();
      //   });
      // }),
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    await Promise.all([
      new Promise(async (res) => {
        clientA.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      new Promise(async (res) => {
        clientB.once(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, res);
      }),
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ]);
    const {
      [clientA.signerAddress]: clientAPostReclaimBal,
      [clientA.nodeSignerAddress]: nodePostReclaimBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostReclaimBal).to.eq(0);
    expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
    const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
      transfer.assetId,
    );
    expect(clientBPostTransferBal).to.eq(transfer.amount);
  });

  it("happy case: client A hashlock transfers tokens to client B through node", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(timelock).add(await provider.getBlockNumber());

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    // both sender + receiver apps installed, sender took action
    await Promise.all([
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer),
      new Promise((res) => {
        clientB.on(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (eventPayload) => {
          expect(eventPayload).to.deep.contain({
            amount: transfer.amount,
            assetId: transfer.assetId,
            type: ConditionalTransferTypes.HashLockTransfer,
            paymentId: lockHash,
            recipient: clientB.publicIdentifier,
          } as EventPayloads.HashLockTransferCreated);
          expect(eventPayload.transferMeta).to.deep.eq({
            timelock,
            lockHash,
            expiry: expiry.sub(100),
          });
          res();
        });
      }),
    ]);

    const {
      [clientA.signerAddress]: clientAPostTransferBal,
      [clientA.nodeSignerAddress]: nodePostTransferBal,
    } = await clientA.getFreeBalance(transfer.assetId);
    expect(clientAPostTransferBal).to.eq(0);

    await new Promise(async (res) => {
      clientA.on(EventNames.UNINSTALL_EVENT, async (data) => {
        const {
          [clientA.signerAddress]: clientAPostReclaimBal,
          [clientA.nodeSignerAddress]: nodePostReclaimBal,
        } = await clientA.getFreeBalance(transfer.assetId);
        expect(clientAPostReclaimBal).to.eq(0);
        expect(nodePostReclaimBal).to.eq(nodePostTransferBal.add(transfer.amount));
        res();
      });
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer);
      const { [clientB.signerAddress]: clientBPostTransferBal } = await clientB.getFreeBalance(
        transfer.assetId,
      );
      expect(clientBPostTransferBal).to.eq(transfer.amount);
    });
  });

  it("gets a pending hashlock transfer by lock hash", async () => {
    const TIMEOUT_BUFFER = 100; // This currently isn't exported by the node so must be hardcoded
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);
    const expiry = BigNumber.from(await provider.getBlockNumber())
      .add(timelock)
      .sub(TIMEOUT_BUFFER);
    // both sender + receiver apps installed, sender took action
    clientA.conditionalTransfer({
      amount: transfer.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transfer.assetId,
      meta: { foo: "bar", sender: clientA.publicIdentifier },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash, transfer.assetId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.PENDING,
      meta: { foo: "bar", sender: clientA.publicIdentifier, timelock, paymentId },
      preImage: HashZero,
      expiry,
    } as NodeResponses.GetHashLockTransfer);
  });

  it("gets a completed hashlock transfer by lock hash", async () => {
    const TIMEOUT_BUFFER = 100; // This currently isn't exported by the node so must be hardcoded
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const expiry = BigNumber.from(await provider.getBlockNumber())
      .add(timelock)
      .sub(TIMEOUT_BUFFER);

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const paymentId = soliditySha256(["address", "bytes32"], [transfer.assetId, lockHash]);

    // both sender + receiver apps installed, sender took action
    await new Promise((resolve, reject) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, resolve);
      clientA
        .conditionalTransfer({
          amount: transfer.amount.toString(),
          conditionType: ConditionalTransferTypes.HashLockTransfer,
          lockHash,
          timelock,
          assetId: transfer.assetId,
          meta: { foo: "bar", sender: clientA.publicIdentifier },
          recipient: clientB.publicIdentifier,
        } as PublicParams.HashLockTransfer)
        .catch((e) => reject(e.message));
    });

    // wait for transfer to be picked up by receiver
    await new Promise(async (resolve, reject) => {
      // Note: MUST wait for uninstall, bc UNLOCKED gets thrown on takeAction
      // at the moment, there's no way to filter the uninstalled app here so
      // we're just gonna resolve and hope for the best
      clientB.once(
        EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT,
        resolve,
        (data) => (data.transferMeta as UnlockedHashLockTransferMeta).preImage === preImage,
      );
      clientB.once(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, reject);
      await clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage,
        assetId: transfer.assetId,
      });
    });

    const retrievedTransfer = await clientB.getHashLockTransfer(lockHash, transfer.assetId);
    expect(retrievedTransfer).to.deep.equal({
      amount: transfer.amount.toString(),
      assetId: transfer.assetId,
      lockHash,
      senderIdentifier: clientA.publicIdentifier,
      receiverIdentifier: clientB.publicIdentifier,
      status: HashLockTransferStatus.COMPLETED,
      preImage,
      expiry,
      meta: { foo: "bar", sender: clientA.publicIdentifier, timelock, paymentId },
    } as NodeResponses.GetHashLockTransfer);
  });

  it("can send two hashlock transfers with different assetIds and the same lock hash", async () => {
    const transferToken: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transferToken.amount, transferToken.assetId);
    const transferEth: AssetOptions = { amount: ETH_AMOUNT_SM, assetId: AddressZero };
    await fundChannel(clientA, transferEth.amount, transferEth.assetId);
    const preImage = getRandomBytes32();
    const timelock = (5000).toString();
    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA.conditionalTransfer({
      amount: transferToken.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transferToken.assetId,
      meta: { foo: "bar" },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    clientA.conditionalTransfer({
      amount: transferEth.amount.toString(),
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      lockHash,
      timelock,
      assetId: transferEth.assetId,
      meta: { foo: "bar" },
      recipient: clientB.publicIdentifier,
    } as PublicParams.HashLockTransfer);
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      preImage,
      assetId: transferToken.assetId,
    } as PublicParams.ResolveHashLockTransfer);

    await clientB.resolveCondition({
      conditionType: ConditionalTransferTypes.HashLockTransfer,
      preImage,
      assetId: transferEth.assetId,
    } as PublicParams.ResolveHashLockTransfer);

    const { [clientB.signerAddress]: freeBalanceToken } = await clientB.getFreeBalance(
      transferToken.assetId,
    );
    const { [clientB.signerAddress]: freeBalanceEth } = await clientB.getFreeBalance(
      transferEth.assetId,
    );

    expect(freeBalanceToken).to.eq(transferToken.amount);
    expect(freeBalanceEth).to.eq(transferEth.amount);
  });

  it("cannot resolve a hashlock transfer if pre image is wrong", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
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
    await new Promise((res) => clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, res));

    const badPreImage = getRandomBytes32();
    await expect(
      clientB.resolveCondition({
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        preImage: badPreImage,
        assetId: transfer.assetId,
      } as PublicParams.ResolveHashLockTransfer),
    ).to.eventually.be.rejectedWith(/app has not been installed/);
  });

  // NOTE: if the node tries to collateralize or send a transaction during
  // this test, it will likely pass due to the 1 block margin of error in the
  // timelock variable
  it("cannot resolve a hashlock if timelock is expired", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };
    await fundChannel(clientA, transfer.amount, transfer.assetId);
    const preImage = getRandomBytes32();
    const timelock = 101;

    const lockHash = soliditySha256(["bytes32"], [preImage]);
    const { appIdentityHash } = ((await new Promise((resolve, reject) => {
      clientB.once(EventNames.CONDITIONAL_TRANSFER_CREATED_EVENT, (data) => resolve(data));
      clientA.once(EventNames.REJECT_INSTALL_EVENT, reject);
      clientA.conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer);
    })) as unknown) as ConditionalTransferCreatedEventData<"HashLockTransferApp">;
    let app = await clientB.getAppInstance(appIdentityHash);
    expect(app).to.be.ok;

    // Wait for more than one block if blocktime > 0
    // for (let i = 0; i < 5; i++) {
    // eslint-disable-next-line no-loop-func
    await new Promise((resolve) => provider.once("block", resolve));
    // }

    await Promise.all([
      new Promise(async (resolve, reject) => {
        try {
          await expect(
            clientB.resolveCondition({
              conditionType: ConditionalTransferTypes.HashLockTransfer,
              preImage,
              assetId: transfer.assetId,
            } as PublicParams.ResolveHashLockTransfer),
          ).to.be.rejectedWith(/Cannot take action if expiry is expired/);
          // take some other channel action to force an uninstall event
          // and expired app cleanup in receiver channel
          await fundChannel(clientB, transfer.amount, tokenAddress);
          resolve();
        } catch (e) {
          reject(e.message);
        }
      }),
      new Promise((resolve) => {
        clientB.once(
          EventNames.UNINSTALL_EVENT,
          (msg) => resolve(msg),
          (msg) => msg.appIdentityHash === appIdentityHash,
        );
      }),
    ]);
    // await expect(
    //   clientB.resolveCondition({
    //     conditionType: ConditionalTransferTypes.HashLockTransfer,
    //     preImage,
    //     assetId: transfer.assetId,
    //   } as PublicParams.ResolveHashLockTransfer),
    // ).to.be.rejectedWith(/Cannot take action if expiry is expired/);

    // make sure the app was uninstalled by the node
    app = await clientB.getAppInstance(appIdentityHash);
    expect(app).to.be.undefined;
  });

  it("cannot install receiver app without sender app installed", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT, assetId: tokenAddress };

    const preImage = getRandomBytes32();
    const timelock = (5000).toString();

    const lockHash = soliditySha256(["bytes32"], [preImage]);

    clientA
      .conditionalTransfer({
        amount: transfer.amount.toString(),
        conditionType: ConditionalTransferTypes.HashLockTransfer,
        lockHash,
        timelock,
        assetId: transfer.assetId,
        meta: { foo: "bar", sender: clientA.publicIdentifier },
        recipient: clientB.publicIdentifier,
      } as PublicParams.HashLockTransfer)
      .catch((e) => {
        console.log("Expected this error: ", e.message);
      });

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

  // FIXME: may not work depending on collateral, will expect some payment
  // errors even with a small number of payments until this is handled better
  it.skip("can send concurrent hashlock transfers", async () => {
    const transfer: AssetOptions = { amount: TOKEN_AMOUNT.div(5), assetId: tokenAddress };
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
