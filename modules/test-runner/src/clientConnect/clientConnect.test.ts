import { Wallet } from "ethers";
import { AddressZero, One } from "ethers/constants";

import { createClient, expect, sendOnchainValue } from "../util";
import { ConnextStore } from "@connext/store";
import { StoreTypes, ClientOptions } from "@connext/types";

describe("Client Connect", () => {
  it("Client should not rescind deposit rights if no transfers have been made to the multisig", async () => {
    const mnemonic = Wallet.createRandom().mnemonic;
    let client = await createClient({ mnemonic });
    const { 
      appInstanceId: ethDeposit, 
    } = await client.requestDepositRights({ assetId: AddressZero });
    const { 
      appInstanceId: tokenDeposit, 
    } = await client.requestDepositRights({ assetId: client.config.contractAddresses.Token });

    // verify
    const { 
      appInstanceId: retrievedEth,
    } = await client.checkDepositRights({ assetId: AddressZero });
    expect(retrievedEth).to.eq(ethDeposit);

    const { 
      appInstanceId: retrievedToken,
    } = await client.checkDepositRights({ assetId: client.config.contractAddresses.Token });
    expect(retrievedToken).to.eq(tokenDeposit);

    // disconnect + reconnect
    await client.messaging.disconnect();
    await client.store.clear();
    client = await createClient({
      mnemonic,
    });

    // verify still installed
    const { 
      appInstanceId: retrievedEth2,
    } = await client.checkDepositRights({ assetId: AddressZero });
    expect(retrievedEth2).to.eq(ethDeposit);

    const { 
      appInstanceId: retrievedToken2,
    } = await client.checkDepositRights({ assetId: client.config.contractAddresses.Token });
    expect(retrievedToken2).to.eq(tokenDeposit);
  });

  it("Client should wait for transfers and rescind deposit rights if it's offline", async () => {
    const mnemonic = Wallet.createRandom().mnemonic;
    const store = new ConnextStore(StoreTypes.Memory);
    let client = await createClient({ mnemonic, store } as Partial<ClientOptions>);
    await client.requestDepositRights({ assetId: AddressZero });
    await client.requestDepositRights({ assetId: client.config.contractAddresses.Token });
    let apps = await client.getAppInstances();
    let depositApps = apps.filter(
      app => app.appInterface.addr === client.config.contractAddresses.DepositApp,
    );
    expect(depositApps.length).to.be.eq(2);
    await client.messaging.disconnect();

    await sendOnchainValue(client.multisigAddress, One);
    await sendOnchainValue(client.multisigAddress, One, client.config.contractAddresses.Token);

    client = await createClient({ mnemonic, store });
    apps = await client.getAppInstances();
    depositApps = apps.filter(
      app => app.appInterface.addr === client.config.contractAddresses.DepositApp,
    );
    expect(depositApps.length).to.be.eq(0);
  });
});
