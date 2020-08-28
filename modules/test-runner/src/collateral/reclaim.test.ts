import { ERC20 } from "@connext/contracts";
import { IConnextClient, Contract, RebalanceProfile } from "@connext/types";
import { getRandomBytes32, toBN } from "@connext/utils";
import { BigNumber, constants } from "ethers";
import { before, describe } from "mocha";

import {
  addRebalanceProfile,
  asyncTransferAsset,
  createClient,
  expect,
  fundChannel,
  getTestLoggers,
} from "../util";

const { AddressZero, One, Two } = constants;

const name = "Reclaim Collateral";
const { log, timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let start: number;

  before(async () => {});

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    log.info(`senderId: ${clientA.publicIdentifier}`);
    log.info(`sender multisig: ${clientA.multisigAddress}`);
    log.info(`recipientId: ${clientB.publicIdentifier}`);
    log.info(`recipient multisig: ${clientB.multisigAddress}`);
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    nodeSignerAddress = clientA.nodeSignerAddress;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    clientA.off();
    clientB.off();
  });

  it("should reclaim ETH with async transfer", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("5"),
      target: toBN("10"),
      reclaimThreshold: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      BigNumber.from(REBALANCE_PROFILE.reclaimThreshold).add(Two),
      AddressZero,
    );
    await clientB.requestCollateral(AddressZero);

    const preBalance = await clientA.ethProvider.getBalance(clientA.multisigAddress);
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res, rej) => {
      const paymentId = getRandomBytes32();
      clientA.ethProvider.on("block", async () => {
        const balance = await clientA.ethProvider.getBalance(clientA.multisigAddress);
        if (preBalance.gt(balance)) {
          clientA.ethProvider.off("block");
          res();
        }
      });
      clientA
        .transfer({
          amount: BigNumber.from(REBALANCE_PROFILE.reclaimThreshold).add(One),
          assetId: AddressZero,
          recipient: clientB.publicIdentifier,
          paymentId,
        })
        .then((t) => log.info(`t: : ${t}`))
        .catch(rej);
    });

    const freeBalancePost = await clientA.getFreeBalance(AddressZero);
    // expect this could be checked pre or post the rest of the transfer, so try to pre-emptively avoid race conditions
    expect(freeBalancePost[nodeSignerAddress].gte(BigNumber.from(REBALANCE_PROFILE.target))).to.be
      .true;
    expect(
      freeBalancePost[nodeSignerAddress].lte(BigNumber.from(REBALANCE_PROFILE.target).add(One)),
    ).to.be.true;
  });

  it("should reclaim tokens after async transfer", async () => {
    const REBALANCE_PROFILE = {
      assetId: tokenAddress,
      collateralizeThreshold: toBN("5"),
      target: toBN("10"),
      reclaimThreshold: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      BigNumber.from(REBALANCE_PROFILE.reclaimThreshold).add(Two),
      tokenAddress,
    );
    await clientB.requestCollateral(tokenAddress);

    // transfer to node to get node over upper bound reclaim
    // first transfer gets to upper bound
    await asyncTransferAsset(
      clientA,
      clientB,
      BigNumber.from(REBALANCE_PROFILE.reclaimThreshold).add(One),
      tokenAddress,
    );

    clientA.on("UNINSTALL_EVENT", (msg) => {
      const { multisigAddress, uninstalledApp } = msg;
      log.info(`sender uninstall event multisig: ${multisigAddress}`);
      log.info(`final app state: ${uninstalledApp.latestState}`);
    });

    clientB.on("UNINSTALL_EVENT", (msg) => {
      const { multisigAddress, uninstalledApp } = msg;
      log.info(`receiver uninstall event multisig: ${multisigAddress}`);
      log.info(`final app state: ${uninstalledApp.latestState}`);
    });

    const tokenContract = new Contract(tokenAddress, ERC20.abi, clientA.ethProvider);
    const preBalance = await tokenContract.balanceOf(clientA.multisigAddress);
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res, rej) => {
      const paymentId = getRandomBytes32();
      clientA.ethProvider.on("block", async () => {
        const balance = await tokenContract.balanceOf(clientA.multisigAddress);
        if (preBalance.gt(balance)) {
          clientA.ethProvider.off("block");
          res();
        }
      });
      clientA
        .transfer({
          amount: One.toString(),
          assetId: tokenAddress,
          recipient: clientB.publicIdentifier,
          paymentId,
        })
        .then((t) => log.info(`t: : ${t}`))
        .catch(rej);
    });

    const freeBalancePost = await clientA.getFreeBalance(tokenAddress);
    // expect this could be checked pre or post the rest of the transfer
    // so try to pre-emptively avoid race conditions
    expect(freeBalancePost[nodeSignerAddress].gte(BigNumber.from(REBALANCE_PROFILE.target))).to.be
      .true;
    expect(
      freeBalancePost[nodeSignerAddress].lte(BigNumber.from(REBALANCE_PROFILE.target).add(One)),
    ).to.be.true;
  });

  it.skip("node should reclaim ETH after linked transfer", async () => {});

  it.skip("node should reclaim tokens after linked transfer", async () => {});
});
