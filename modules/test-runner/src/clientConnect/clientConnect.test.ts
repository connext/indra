import { getMemoryStore } from "@connext/store";
import { ClientOptions } from "@connext/types";
import { getRandomChannelSigner } from "@connext/utils";
import { Wallet, constants, utils } from "ethers";

import { createClient, expect, sendOnchainValue, env, fundChannel, ETH_AMOUNT_SM } from "../util";

const { AddressZero, One } = constants;
const { hexlify, randomBytes } = utils;

describe("Client Connect", () => {
  it("Client should not rescind deposit rights if no transfers have been made to the multisig", async () => {
    const signer = getRandomChannelSigner();
    let client = await createClient({ signer });
    const { appIdentityHash: ethDeposit } = await client.requestDepositRights({
      assetId: AddressZero,
    });
    const { appIdentityHash: tokenDeposit } = await client.requestDepositRights({
      assetId: client.config.contractAddresses.Token!,
    });

    // verify
    const { appIdentityHash: retrievedEth } = await client.checkDepositRights({
      assetId: AddressZero,
    });
    expect(retrievedEth).to.eq(ethDeposit);

    const { appIdentityHash: retrievedToken } = await client.checkDepositRights({
      assetId: client.config.contractAddresses.Token!,
    });
    expect(retrievedToken).to.eq(tokenDeposit);

    // disconnect + reconnect
    await client.messaging.disconnect();
    await client.store.clear();
    client = await createClient({ signer });

    // verify still installed
    const { appIdentityHash: retrievedEth2 } = await client.checkDepositRights({
      assetId: AddressZero,
    });
    expect(retrievedEth2).to.eq(ethDeposit);

    const { appIdentityHash: retrievedToken2 } = await client.checkDepositRights({
      assetId: client.config.contractAddresses.Token!,
    });
    expect(retrievedToken2).to.eq(tokenDeposit);
  });

  it("Client should wait for transfers and rescind deposit rights if it's offline", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    let client = await createClient({ signer: pk, store } as Partial<ClientOptions>);
    await client.requestDepositRights({ assetId: AddressZero });
    await client.requestDepositRights({ assetId: client.config.contractAddresses.Token! });
    let apps = await client.getAppInstances();
    const initDepositApps = apps.filter(
      (app) =>
        app.appDefinition === client.config.contractAddresses.DepositApp &&
        app.initiatorIdentifier === client.publicIdentifier,
    );
    expect(initDepositApps.length).to.be.eq(2);
    await client.messaging.disconnect();

    await sendOnchainValue(client.multisigAddress, One);
    await sendOnchainValue(client.multisigAddress, One, client.config.contractAddresses.Token!);

    client = await createClient({ signer: pk, store });
    apps = await client.getAppInstances();
    const depositApps = apps.filter(
      (app) =>
        app.appDefinition === client.config.contractAddresses.DepositApp &&
        app.initiatorIdentifier === client.publicIdentifier,
    );
    expect(depositApps.length).to.be.eq(0);
  });

  it.skip("Client should attempt to wait for user withdrawal if there are withdraw commitments in store", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    store.saveUserWithdrawal({
      tx: {
        to: Wallet.createRandom().address,
        value: 0,
        data: hexlify(randomBytes(32)),
      },
      retry: 0,
    });
    expect(await createClient({ signer: pk, store })).rejectedWith("Something");
  });

  it("Client should not need to wait for user withdrawal after successful withdraw", async () => {
    const pk = Wallet.createRandom().privateKey;
    const store = getMemoryStore();
    const client = await createClient({ signer: pk, store });
    await fundChannel(client, ETH_AMOUNT_SM);
    await client.withdraw({
      amount: ETH_AMOUNT_SM,
      recipient: Wallet.createRandom().address,
      assetId: AddressZero,
    });
    await client.messaging.disconnect();

    // now try to restart client (should succeed)
    expect(await createClient({ signer: pk, store })).to.be.ok;
  });
});
