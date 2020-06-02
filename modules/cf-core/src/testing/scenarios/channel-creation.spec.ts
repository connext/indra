import { CreateChannelMessage, EventNames } from "@connext/types";
import { utils } from "ethers";

import { CFCore } from "../../cfCore";

import { setup, SetupContext } from "../setup";
import {
  assertMessage,
  confirmChannelCreation,
  constructChannelCreationRpc,
  getChannelAddresses,
  getMultisigCreationAddress,
} from "../utils";

const { isHexString } = utils;

describe("Node can create multisig, other owners get notified", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;
  let nodeC: CFCore;

  beforeAll(async () => {
    const context: SetupContext = await setup(global, true);
    nodeA = context["A"].node;
    nodeB = context["B"].node;
    nodeC = context["C"].node;
  });

  it("Node A and Node B can create a channel", async (done) => {
    const owners = [nodeA.publicIdentifier, nodeB.publicIdentifier];

    const expectedMsg = {
      from: nodeB.publicIdentifier,
      type: EventNames.CREATE_CHANNEL_EVENT,
      data: {
        owners: [nodeB.signerAddress, nodeA.signerAddress],
      },
    };

    let assertionCount = 0;

    nodeA.once(EventNames.CREATE_CHANNEL_EVENT, async (msg) => {
      assertMessage<typeof EventNames.CREATE_CHANNEL_EVENT>(msg, expectedMsg, [
        "data.multisigAddress",
      ]);
      assertionCount += 1;
      if (assertionCount === 2) done();
    });

    nodeB.once(EventNames.CREATE_CHANNEL_EVENT, async (msg) => {
      assertMessage<typeof EventNames.CREATE_CHANNEL_EVENT>(msg, expectedMsg, [
        "data.multisigAddress",
      ]);
      assertionCount += 1;
      if (assertionCount === 3) done();
    });

    const {
      result: {
        result: { multisigAddress },
      },
    } = await nodeB.rpcRouter.dispatch(constructChannelCreationRpc(owners));
    expect(isHexString(multisigAddress)).toBeTruthy();
    assertionCount += 1;
    if (assertionCount === 3) done();
  });

  describe("Queued channel creation", () => {
    it("Node A can create multiple back-to-back channels with Node B and Node C", async (done) => {
      const ownersABPublicIdentifiers = [nodeA.publicIdentifier, nodeB.publicIdentifier];

      const ownersABFreeBalanceAddr = [nodeA.signerAddress, nodeB.signerAddress];

      const ownersACPublicIdentifiers = [nodeA.publicIdentifier, nodeC.publicIdentifier];

      const ownersACFreeBalanceAddr = [nodeA.signerAddress, nodeC.signerAddress];

      nodeA.on(EventNames.CREATE_CHANNEL_EVENT, async (msg: CreateChannelMessage) => {
        if (msg.data.owners === ownersABPublicIdentifiers) {
          const openChannelsNodeA = await getChannelAddresses(nodeA);
          const openChannelsNodeB = await getChannelAddresses(nodeB);

          expect(openChannelsNodeA.size).toEqual(1);
          expect(openChannelsNodeB.size).toEqual(1);

          await confirmChannelCreation(nodeA, nodeB, msg.data, ownersABFreeBalanceAddr);
        } else {
          const openChannelsNodeA = await getChannelAddresses(nodeA);
          const openChannelsNodeC = await getChannelAddresses(nodeC);

          expect(openChannelsNodeA.size).toEqual(2);
          expect(openChannelsNodeC.size).toEqual(1);

          await confirmChannelCreation(nodeA, nodeC, msg.data, ownersACFreeBalanceAddr);

          done();
        }
      });

      const txHash1 = await getMultisigCreationAddress(nodeA, ownersABPublicIdentifiers);

      const txHash2 = await getMultisigCreationAddress(nodeA, ownersACPublicIdentifiers);

      expect(txHash1).toBeDefined();
      expect(txHash2).toBeDefined();
    });
  });
});
