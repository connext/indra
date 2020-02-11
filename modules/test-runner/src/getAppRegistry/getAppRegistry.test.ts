import { addressBook } from "@connext/contracts";
import { DefaultApp, IConnextClient } from "@connext/types";

import { expect } from "../util";
import { createClient } from "../util/client";

const expectedNetwork = {
  name: "ganache",
  chainId: 4447,
};
const expectedAddresses = addressBook[expectedNetwork.chainId];

const verifyApp = (app: DefaultApp): void => {
  expect(app.chainId).to.be.equal(expectedNetwork.chainId);
  expect(app.name).to.exist;
  expect(app.appDefinitionAddress).to.be.equal(expectedAddresses[app.name].address);
};

describe("Get App Registry", () => {
  let client: IConnextClient;

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("Happy case: user receives all the app registry information", async () => {
    client = await createClient();
    expect(client.multisigAddress).to.exist;
    const appRegistry = await client.getAppRegistry();
    expect(appRegistry.length).to.equal(4);
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app", async () => {
    client = await createClient();
    const appRegistry = await client.getAppRegistry({
      name: "CoinBalanceRefundApp",
      chainId: 4447,
    });
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app using address", async () => {
    client = await createClient();
    const appRegistry = await client.getAppRegistry({
      appDefinitionAddress: expectedAddresses.CoinBalanceRefundApp.address,
    });
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });
});
