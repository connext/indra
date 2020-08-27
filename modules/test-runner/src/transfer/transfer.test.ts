import { IConnextClient, EventNames } from "@connext/types";
import { BigNumber, constants } from "ethers";

import {
  ETH_AMOUNT_SM,
  TOKEN_AMOUNT_SM,
  createClient,
  expect,
  fundChannel,
  getTestLoggers,
  requestCollateral,
} from "../util";
import { asyncTransferAsset } from "../util/helpers/asyncTransferAsset";

const { AddressZero } = constants;

const name = "Multiple Transfers";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let clientA: IConnextClient;
  let clientB: IConnextClient;
  let clientC: IConnextClient;
  let clientD: IConnextClient;
  let start: number;
  let tokenAddress: string;

  beforeEach(async () => {
    start = Date.now();
    clientA = await createClient({ id: "A" });
    clientB = await createClient({ id: "B" });
    clientC = await createClient({ id: "C" });
    clientD = await createClient({ id: "D" });
    tokenAddress = clientA.config.contractAddresses[clientA.chainId].Token!;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await clientA.off();
    await clientB.off();
    await clientC.off();
    await clientD.off();
  });

  it("User transfers ETH to multiple clients", async () => {
    await fundChannel(clientA, ETH_AMOUNT_SM.mul(4), AddressZero);
    await requestCollateral(clientB, AddressZero);
    await requestCollateral(clientC, AddressZero);
    await requestCollateral(clientD, AddressZero);
    await asyncTransferAsset(clientA, clientB, ETH_AMOUNT_SM, AddressZero);
    await asyncTransferAsset(clientA, clientC, ETH_AMOUNT_SM, AddressZero);
    await asyncTransferAsset(clientA, clientD, ETH_AMOUNT_SM, AddressZero);
  });

  it("User transfers tokens to multiple clients (case-insensitive assetId)", async () => {
    await fundChannel(clientA, TOKEN_AMOUNT_SM.mul(4), tokenAddress);
    await requestCollateral(clientB, tokenAddress);
    await requestCollateral(clientC, tokenAddress);
    await requestCollateral(clientD, tokenAddress);
    await asyncTransferAsset(clientA, clientB, TOKEN_AMOUNT_SM, tokenAddress.toUpperCase());
    await asyncTransferAsset(clientA, clientC, TOKEN_AMOUNT_SM, tokenAddress.toUpperCase());
    await asyncTransferAsset(clientA, clientD, TOKEN_AMOUNT_SM, tokenAddress.toUpperCase());
  });

  it("User receives multiple ETH transfers ", async () => {
    await fundChannel(clientB, ETH_AMOUNT_SM, AddressZero);
    await fundChannel(clientC, ETH_AMOUNT_SM, AddressZero);
    await fundChannel(clientD, ETH_AMOUNT_SM, AddressZero);
    await requestCollateral(clientA, AddressZero);
    await asyncTransferAsset(clientB, clientA, ETH_AMOUNT_SM, AddressZero);
    await asyncTransferAsset(clientC, clientA, ETH_AMOUNT_SM, AddressZero);
    await asyncTransferAsset(clientD, clientA, ETH_AMOUNT_SM, AddressZero);
  });

  it("User receives multiple token transfers ", async () => {
    await fundChannel(clientB, TOKEN_AMOUNT_SM, tokenAddress);
    await fundChannel(clientC, TOKEN_AMOUNT_SM, tokenAddress);
    await fundChannel(clientD, TOKEN_AMOUNT_SM, tokenAddress);
    await requestCollateral(clientA, tokenAddress);
    await asyncTransferAsset(clientB, clientA, TOKEN_AMOUNT_SM, tokenAddress);
    await asyncTransferAsset(clientC, clientA, TOKEN_AMOUNT_SM, tokenAddress);
    await asyncTransferAsset(clientD, clientA, TOKEN_AMOUNT_SM, tokenAddress);
  });

  it("Client receives transfers concurrently", () => {
    return new Promise(async (res, rej) => {
      // TODO: should work without collateral as well
      // seems there is a condition --> receiver sends resolve req.
      // while user has deposit in flight and node has insufficient
      // collateral. node will not allow the resolution of that payment
      await requestCollateral(clientA, AddressZero, true);
      await fundChannel(clientB, BigNumber.from(5));
      await fundChannel(clientC, BigNumber.from(5));
      let transferCount = 0;
      clientA.on(EventNames.CONDITIONAL_TRANSFER_UNLOCKED_EVENT, async () => {
        transferCount += 1;
        if (transferCount === 2) {
          expect(transferCount).to.eq(2);
          res();
        }
      });

      clientA.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientA`),
      );
      clientB.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientB`),
      );
      clientC.on(EventNames.CONDITIONAL_TRANSFER_FAILED_EVENT, () =>
        rej(`Received transfer failed event on clientC`),
      );
      await Promise.all([
        clientB.transfer({
          amount: "1",
          assetId: AddressZero,
          recipient: clientA.publicIdentifier,
        }),
        clientC.transfer({
          amount: "1",
          assetId: AddressZero,
          recipient: clientA.publicIdentifier,
        }),
      ]);
    });
  });
});
