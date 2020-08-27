import { DefaultApp, IConnextClient, AppRegistry } from "@connext/types";

import { createClient, env, expect, getTestLoggers } from "../util";

const verifyApp = (app: DefaultApp): void => {
  expect(app.chainId).to.be.ok;
  expect(app.name).to.be.ok;
};

const name = "Get App Registry";
const { timeElapsed } = getTestLoggers(name);
describe(name, () => {
  let client: IConnextClient;
  let start: number;

  beforeEach(async () => {
    start = Date.now();
    client = await createClient();
    expect(client.multisigAddress).to.exist;
    timeElapsed("beforeEach complete", start);
  });

  afterEach(async () => {
    await client.off();
  });

  it("Happy case: user receives all the app registry information", async () => {
    const appRegistry = (await client.getAppRegistry()) as AppRegistry;
    appRegistry.forEach((app: DefaultApp) => verifyApp(app));
  });

  it("Happy case: user receives registry information for specific app", async () => {
    const appRegistry = await client.getAppRegistry({
      chainId: 1337,
      name: "WithdrawApp",
    });
    verifyApp(appRegistry as DefaultApp);
  });

  it("Happy case: user receives registry information for specific app using address", async () => {
    const appRegistry = await client.getAppRegistry({
      appDefinitionAddress: env.contractAddresses[env.defaultChain].DepositApp.address,
    });
    expect(appRegistry).to.be.ok;
    verifyApp(appRegistry as DefaultApp);
  });
});
