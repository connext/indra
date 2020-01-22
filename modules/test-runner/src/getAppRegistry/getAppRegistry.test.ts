import { addressBook } from "@connext/contracts";
import { DefaultApp, IConnextClient } from "@connext/types";

import { expect } from "../util";
import { createClient } from "../util/client";

describe("Get App Registry", () => {
  let client: IConnextClient;

  const expectedNetwork = {
    name: "ganache",
    id: "4447",
  };
  const expectedAddresses = addressBook[expectedNetwork.id];
  beforeEach(async () => {
    client = await createClient();
    expect(client.multisigAddress).to.exist;
  });

  const verifyApp = (app: DefaultApp): void => {
    expect(app.network).to.be.equal(expectedNetwork.name);
    expect(app.name).to.exist;
    expect(app.appDefinitionAddress).to.be.equal(expectedAddresses[app.name].address);
  };

  it("Happy case: user receives all the app registry information", async () => {
    const appRegistry = await client.getAppRegistry();
    expect(appRegistry.length).to.equal(4);
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app", async () => {
    const appRegistry = await client.getAppRegistry({
      name: "CoinBalanceRefundApp",
      network: "ganache",
    });
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app using address", async () => {
    const appRegistry = await client.getAppRegistry({
      appDefinitionAddress: expectedAddresses.CoinBalanceRefundApp.address,
    });
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });
});
