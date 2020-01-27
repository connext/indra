import { IConnextClient, DefaultApp } from "@connext/types";
import * as lolex from "lolex";

import {
  expect,
  cleanupMessaging,
  createClientWithMessagingLimits,
  TOKEN_AMOUNT,
  fundChannel,
  requestCollateral,
  fastForwardDuringCall,
  asyncTransferAsset,
  TOKEN_AMOUNT_SM,
  MESSAGE_FAILED_TO_SEND,
} from "../util";
import { BigNumber } from "ethers/utils";

describe.only("Async transfer offline tests", () => {
  let clock: any;
  let senderClient: IConnextClient;
  let receiverClient: IConnextClient;
  let tokenAddress: string;

  /////////////////////////////////
  /// TEST SPECIFIC HELPERS
  const fundForTransfers = async (
    amount: BigNumber = TOKEN_AMOUNT,
    assetId?: string,
  ): Promise<void> => {
    // make sure the tokenAddress is set
    tokenAddress = senderClient.config.contractAddresses.Token;
    await fundChannel(senderClient, amount, assetId || tokenAddress);
    await requestCollateral(receiverClient, assetId || tokenAddress);
  };

  const getLinkedApp = async (client: IConnextClient, onlyOne: boolean = true): Promise<any> => {
    const registeredApp = client.appRegistry.filter(
      (app: DefaultApp) => app.name === "SimpleLinkedTransferApp",
    )[0];
    const linkedApps = (await client.getAppInstances()).filter(
      app => app.appInterface.addr === registeredApp.appDefinitionAddress,
    );
    // make sure the state is correct
    if (onlyOne) {
      expect(linkedApps.length).to.be.equal(1);
      return linkedApps[0];
    }
    expect(linkedApps).to.be.ok;
    return linkedApps;
  };

  const verifyTransfer = async (
    client: IConnextClient,
    expected: any, //Partial<Transfer> type uses `null` not `undefined`
  ): Promise<void> => {
    expect(expected.paymentId).to.be.ok;
    const transfer = await client.getLinkedTransfer(expected.paymentId!);
    // verify the saved transfer information
    expect(transfer).to.containSubset(expected);
  };

  beforeEach(async () => {
    // create the clock
    clock = lolex.install({
      shouldAdvanceTime: true,
      advanceTimeDelta: 1,
      now: Date.now(),
    });
  });

  it("sender successfully installs transfer, goes offline before sending paymentId or preimage, then comes online and has the pending installed transfer", async () => {
    /**
     * In this case, node will not know the recipient or encrypted preimage,
     * the transfer to recipient is essentially installed as an unclaimable
     * (i.e. preImage lost) linked transfer without a specified recipient.
     *
     * Avoid `transfer.set-recipient.${this.userPublicIdentifier}` endpoint
     * with the hub. The hub should clean these up during disputes
     */

    // create the sender client and receiver clients
    senderClient = await createClientWithMessagingLimits({
      forbiddenSubjects: [`transfer.set-recipient`],
    });
    receiverClient = await createClientWithMessagingLimits();

    // fund the channels
    await fundForTransfers();

    // make the transfer call, should fail when sending info to node, but
    // will retry. fast forward through NATS_TIMEOUT
    await fastForwardDuringCall(
      89_000,
      () => asyncTransferAsset(senderClient, receiverClient, TOKEN_AMOUNT_SM, tokenAddress),
      clock,
      MESSAGE_FAILED_TO_SEND(`Subject is in forbidden URLs, refusing to publish data`),
    );

    // make sure that the app is installed with the hub/sender
    const senderLinkedApp = await getLinkedApp(senderClient);
    const { paymentId } = senderLinkedApp.latestState as any;
    // verify the saved transfer information
    await verifyTransfer(senderClient, {
      amount: TOKEN_AMOUNT_SM.toString(),
      receiverPublicIdentifier: null,
      paymentId,
      senderPublicIdentifier: senderClient.publicIdentifier,
      status: "PENDING",
      type: "LINKED",
    });
    const receiverLinkedApp = await getLinkedApp(receiverClient, false);
    expect(receiverLinkedApp.length).to.equal(0);
  });

  it("sender successfully installs transfer, goes offline before sending paymentId/preimage, and stays offline", async () => {});

  it("sender installs transfer successfully, receiver proposes install but node is offline", async () => {});

  it("sender installs transfer successfully, receiver installs successfully, but node is offline", async () => {});

  it("sender installs transfer successfully, receiver install succesfully, takesAction, then goes offline", async () => {});

  it("sender installs, receiver installs, takesAction, then uninstalls. Node tries to take action with sender but sender is offline but then comes online later (node needs to know sender is back online and clean up pending transfers)", async () => {});

  it("sender installs, receiver installs, takesAction, then uninstalls. Node takes action, then uninstalls with sender but sender goes offline during uninstall and comes back on later", async () => {});

  afterEach(async () => {
    await cleanupMessaging();
    if (clock) {
      clock.reset();
    }
  });
});
