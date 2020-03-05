import { AddressZero } from "ethers/constants";

import { createClient, expect } from "../util";
import { Wallet } from "ethers";

describe("Client Connect", () => {
  it("Client should rescind deposit rights on startup", async () => {
    const mnemonic = Wallet.createRandom().mnemonic;
    let client = await createClient({ mnemonic });
    await client.requestDepositRights({ assetId: AddressZero });
    await client.requestDepositRights({ assetId: client.config.contractAddresses.Token });
    let apps = await client.getAppInstances();
    let coinBalanceRefunds = apps.filter(
      app => app.appInterface.addr === client.config.contractAddresses.CoinBalanceRefundApp,
    );
    expect(coinBalanceRefunds.length).to.be.eq(2);

    client = await createClient({ mnemonic });
    apps = await client.getAppInstances();
    coinBalanceRefunds = apps.filter(
      app => app.appInterface.addr === client.config.contractAddresses.CoinBalanceRefundApp,
    );
    expect(coinBalanceRefunds.length).to.be.eq(0);
  });
});
