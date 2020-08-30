import { IConnextClient, CONVENTION_FOR_ETH_ASSET_ID } from "@connext/types";
import { constants } from "ethers";

import {
  createClient,
  ethProvider,
  expect,
  getOnchainBalance,
  getTestLoggers,
  sendOnchainValue,
} from "../util";

const { One, Zero } = constants;

const name = "Deposits Rights";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
  });

  afterEach(async () => {
    await client.off();
  });

  it("should request deposit rights and deposit ETH", async () => {
    const assetId = CONVENTION_FOR_ETH_ASSET_ID;
    const depositAmount = One;
    client = await createClient();
    await client.requestDepositRights({ assetId });
    const { [client.signerAddress]: preDeposit } = await client.getFreeBalance(assetId);
    expect(preDeposit).to.be.eq(Zero);
    const initialBalance = await getOnchainBalance(client.multisigAddress);
    await new Promise(
      async (res: any, rej: any): Promise<any> => {
        // ignore events when listener is registered
        ethProvider.on("block", async () => {
          const balance = await getOnchainBalance(client.multisigAddress);
          if (balance.eq(initialBalance)) {
            return;
          }
          try {
            // node could have collateralized
            expect(balance).to.be.eq(initialBalance.add(depositAmount));
            await client.rescindDepositRights({ assetId });
            const { [client.signerAddress]: postDeposit } = await client.getFreeBalance(assetId);
            expect(postDeposit).to.be.eq(preDeposit.add(depositAmount));
            res();
          } catch (e) {
            rej(e);
          } finally {
            ethProvider.off("block");
          }
        });
        try {
          await sendOnchainValue(client.multisigAddress, depositAmount, assetId);
        } catch (e) {
          rej(e);
        }
      },
    );
    timeElapsed("Test complete", start);
  });

  it("should request deposit rights and deposit token (case-insensitive assetId)", async () => {
    client = await createClient();
    const assetId = client.config.contractAddresses[client.chainId].Token!.toUpperCase();
    const depositAmount = One;
    await client.requestDepositRights({ assetId });
    const { [client.signerAddress]: preDeposit } = await client.getFreeBalance(assetId);
    expect(preDeposit).to.be.eq(Zero);
    const initialBalance = await getOnchainBalance(client.multisigAddress, assetId);
    expect(initialBalance).to.be.eq(Zero);
    await new Promise(
      async (res: any, rej: any): Promise<any> => {
        ethProvider.on("block", async () => {
          const balance = await getOnchainBalance(client.multisigAddress, assetId);
          if (balance.eq(initialBalance)) {
            return;
          }
          try {
            expect(balance).to.be.eq(depositAmount);
            await client.rescindDepositRights({ assetId });
            const { [client.signerAddress]: postDeposit } = await client.getFreeBalance(assetId);
            expect(postDeposit).to.be.eq(depositAmount);
            res();
          } catch (e) {
            rej(e);
          } finally {
            ethProvider.off("block");
          }
        });
        try {
          await sendOnchainValue(client.multisigAddress, depositAmount, assetId);
        } catch (e) {
          rej(e);
        }
      },
    );
    timeElapsed("Test complete", start);
  });
});
