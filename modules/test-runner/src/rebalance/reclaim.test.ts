import { IConnextClient, Contract, RebalanceProfile } from "@connext/types";
import { getRandomBytes32, toBN } from "@connext/utils";
import { constants, utils } from "ethers";
import { before, describe } from "mocha";
import { Client } from "ts-nats";

import { createClient, fundChannel, asyncTransferAsset, expect } from "../util";
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";
import { getNatsClient } from "../util/nats";
import { ERC20 } from "@connext/contracts";

const { AddressZero, One, Two } = constants;
const { bigNumberify } = utils;

describe("Reclaim", () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let tokenAddress: string;
  let nodeSignerAddress: string;
  let nats: Client;

  before(async () => {
    nats = getNatsClient();
  });

  beforeEach(async () => {
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    tokenAddress = clientA.config.contractAddresses.Token!;
    nodeSignerAddress = clientA.nodeSignerAddress;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: node should reclaim ETH with async transfer", async () => {
    const REBALANCE_PROFILE: RebalanceProfile = {
      assetId: AddressZero,
      collateralizeThreshold: toBN("5"),
      target: toBN("10"),
      reclaimThreshold: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(nats, clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      bigNumberify(REBALANCE_PROFILE.reclaimThreshold).add(Two),
      AddressZero,
    );
    await clientB.requestCollateral(AddressZero);

    // transfer to node to get node over upper bound reclaim
    // first transfer gets to upper bound
    await asyncTransferAsset(
      clientA,
      clientB,
      bigNumberify(REBALANCE_PROFILE.reclaimThreshold).add(One),
      AddressZero,
      nats,
    );

    const preBalance = await clientA.ethProvider.getBalance(clientA.multisigAddress);
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res) => {
      const paymentId = getRandomBytes32();
      clientA.ethProvider.on(clientA.multisigAddress, (balance) => {
        if (preBalance.gt(balance)) {
          res();
        }
      });
      await clientA.transfer({
        amount: One.toString(),
        assetId: AddressZero,
        recipient: clientB.publicIdentifier,
        paymentId,
      });
    });

    const freeBalancePost = await clientA.getFreeBalance(AddressZero);
    // expect this could be checked pre or post the rest of the transfer, so try to pre-emptively avoid race conditions
    expect(freeBalancePost[nodeSignerAddress].gte(bigNumberify(REBALANCE_PROFILE.target))).to.be
      .true;
    expect(freeBalancePost[nodeSignerAddress].lte(bigNumberify(REBALANCE_PROFILE.target).add(One)))
      .to.be.true;
  });

  it("happy case: node should reclaim tokens after async transfer", async () => {
    const REBALANCE_PROFILE = {
      assetId: tokenAddress,
      collateralizeThreshold: toBN("5"),
      target: toBN("10"),
      reclaimThreshold: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(nats, clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      bigNumberify(REBALANCE_PROFILE.reclaimThreshold).add(Two),
      tokenAddress,
    );
    await clientB.requestCollateral(tokenAddress);

    // transfer to node to get node over upper bound reclaim
    // first transfer gets to upper bound
    await asyncTransferAsset(
      clientA,
      clientB,
      bigNumberify(REBALANCE_PROFILE.reclaimThreshold).add(One),
      tokenAddress,
      nats,
    );

    const tokenContract = new Contract(tokenAddress, ERC20.abi, clientA.ethProvider);
    const preBalance = await tokenContract.functions.balanceOf(clientA.multisigAddress);
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res) => {
      const paymentId = getRandomBytes32();
      tokenContract.on("Transfer", (from, to, balance) => {
        if (to === clientA.nodeSignerAddress && preBalance.gt(balance)) {
          res();
        }
      });
      await clientA.transfer({
        amount: One.toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
        paymentId,
      });
    });

    const freeBalancePost = await clientA.getFreeBalance(tokenAddress);
    // expect this could be checked pre or post the rest of the transfer, so try to pre-emptively avoid race conditions
    expect(freeBalancePost[nodeSignerAddress].gte(bigNumberify(REBALANCE_PROFILE.target))).to.be
      .true;
    expect(freeBalancePost[nodeSignerAddress].lte(bigNumberify(REBALANCE_PROFILE.target).add(One)))
      .to.be.true;
  });

  it.skip("happy case: node should reclaim ETH after linked transfer", async () => {});

  it.skip("happy case: node should reclaim tokens after linked transfer", async () => {});
});
