import { EventNames, IConnextClient } from "@connext/types";
import { getRandomBytes32, toBN } from "@connext/utils";
import { BigNumber, constants } from "ethers";
import { before, describe } from "mocha";
import { Client } from "ts-nats";

import { createClient, fundChannel, asyncTransferAsset, expect } from "../util";
import { addRebalanceProfile } from "../util/helpers/rebalanceProfile";
import { getNatsClient } from "../util/nats";

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
    clientA = await createClient();
    clientB = await createClient();
    tokenAddress = clientA.config.contractAddresses.Token;
    nodeSignerAddress = clientA.nodeSignerAddress;
  });

  afterEach(async () => {
    await clientA.messaging.disconnect();
    await clientB.messaging.disconnect();
  });

  it("happy case: node should reclaim ETH with async transfer", async () => {
    const REBALANCE_PROFILE = {
      assetId: constants.AddressZero,
      lowerBoundCollateralize: toBN("5"),
      upperBoundCollateralize: toBN("10"),
      lowerBoundReclaim: toBN("20"),
      upperBoundReclaim: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(nats, clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      BigNumber.from(REBALANCE_PROFILE.upperBoundReclaim).add(constants.Two),
      constants.AddressZero,
    );
    await clientB.requestCollateral(constants.AddressZero);

    // transfer to node to get node over upper bound reclaim
    // first transfer gets to upper bound
    await asyncTransferAsset(
      clientA,
      clientB,
      BigNumber.from(REBALANCE_PROFILE.upperBoundReclaim).add(constants.One),
      constants.AddressZero,
      nats,
    );
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res) => {
      const paymentId = getRandomBytes32();
      clientA.on(EventNames.UPDATE_STATE_EVENT, async (data) => {
        if (data.newState.data) {
          res();
        }
      });
      await clientA.transfer({
        amount: constants.One.toString(),
        assetId: constants.AddressZero,
        recipient: clientB.publicIdentifier,
        paymentId,
      });
    });

    const freeBalancePost = await clientA.getFreeBalance(constants.AddressZero);
    // expect this could be checked pre or post the rest of the transfer, so try to pre-emptively avoid race conditions
    expect(
      freeBalancePost[nodeSignerAddress].gte(BigNumber.from(REBALANCE_PROFILE.lowerBoundReclaim)),
    ).to.be.true;
    expect(
      freeBalancePost[nodeSignerAddress].lte(
        BigNumber.from(REBALANCE_PROFILE.lowerBoundReclaim).add(constants.One),
      ),
    ).to.be.true;
  });

  it("happy case: node should reclaim tokens after async transfer", async () => {
    const REBALANCE_PROFILE = {
      assetId: tokenAddress,
      lowerBoundCollateralize: toBN("5"),
      upperBoundCollateralize: toBN("10"),
      lowerBoundReclaim: toBN("20"),
      upperBoundReclaim: toBN("30"),
    };

    // set rebalancing profile to reclaim collateral
    await addRebalanceProfile(nats, clientA, REBALANCE_PROFILE);

    // deposit client
    await fundChannel(
      clientA,
      BigNumber.from(REBALANCE_PROFILE.upperBoundReclaim).add(constants.Two),
      tokenAddress,
    );
    await clientB.requestCollateral(constants.AddressZero);

    // transfer to node to get node over upper bound reclaim
    // first transfer gets to upper bound
    await asyncTransferAsset(
      clientA,
      clientB,
      BigNumber.from(REBALANCE_PROFILE.upperBoundReclaim).add(constants.One),
      tokenAddress,
      nats,
    );
    // second transfer triggers reclaim
    // verify that node reclaims until lower bound reclaim
    await new Promise(async (res) => {
      const paymentId = getRandomBytes32();
      clientA.on(EventNames.UPDATE_STATE_EVENT, async (data) => {
        if (data.newState.data) {
          res();
        }
      });
      await clientA.transfer({
        amount: constants.One.toString(),
        assetId: tokenAddress,
        recipient: clientB.publicIdentifier,
        paymentId,
      });
    });

    const freeBalancePost = await clientA.getFreeBalance(tokenAddress);
    // expect this could be checked pre or post the rest of the transfer, so try to pre-emptively avoid race conditions
    expect(
      freeBalancePost[nodeSignerAddress].gte(BigNumber.from(REBALANCE_PROFILE.lowerBoundReclaim)),
    ).to.be.true;
    expect(
      freeBalancePost[nodeSignerAddress].lte(
        BigNumber.from(REBALANCE_PROFILE.lowerBoundReclaim).add(constants.One),
      ),
    ).to.be.true;
  });

  it.skip("happy case: node should reclaim ETH after linked transfer", async () => {});

  it.skip("happy case: node should reclaim tokens after linked transfer", async () => {});
});
