import { addressBook } from "@connext/contracts";
import { DefaultApp, IConnextClient, AppRegistry, SupportedApplicationNames } from "@connext/types";

import { expect } from "../util";
import { createClient } from "../util/client";

const expectedNetwork = {
  chainId: 1337,
  name: "ganache",
};
const expectedAddresses = addressBook[expectedNetwork.chainId];

const verifyApp = (app: DefaultApp): void => {
  expect(app.chainId).to.be.equal(expectedNetwork.chainId);
  expect(app.name).to.exist;
};

describe("Get App Registry", () => {
  let client: IConnextClient;

  afterEach(async () => {
    await client.messaging.disconnect();
  });

  it("Happy case: user receives all the app registry information", async () => {
    client = await createClient();
    expect(client.multisigAddress).to.exist;
    const appRegistry = (await client.getAppRegistry()) as AppRegistry;
    expect(appRegistry.length).to.equal(Object.keys(SupportedApplicationNames).length);
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app", async () => {
    client = await createClient();
    const appRegistry = await client.getAppRegistry({
      chainId: 1337,
      name: "WithdrawApp",
    });
    verifyApp(appRegistry as DefaultApp);
  });

  it("Happy case: user receives registry information for specific app using address", async () => {
    client = await createClient();
    const appRegistry = await client.getAppRegistry({
      appDefinitionAddress: expectedAddresses.DepositApp.address,
    });
    expect(appRegistry).to.be.ok;
    verifyApp(appRegistry as DefaultApp);
  });
});
