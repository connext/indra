import { StoreTypes } from "../types";

import {
  createStore,
  expect,
  TEST_STORE_CHANNEL,
  TEST_STORE_MINIMAL_TX,
  TEST_STORE_SET_STATE_COMMITMENT,
} from "./utils";

describe("Instantiation", () => {

  it("Multiple memory stores should be able to run concurrently", async () => {
    const channel = TEST_STORE_CHANNEL;
    const store1 = await createStore(StoreTypes.Memory);
    const store2 = await createStore(StoreTypes.Memory);
    const [nullValue1, nullValue2] = await Promise.all([
      store1.getStateChannel(channel.multisigAddress),
      store2.getStateChannel(channel.multisigAddress),
    ]);
    expect(nullValue1).to.be.undefined;
    expect(nullValue2).to.be.undefined;
    await Promise.all([
      store1.createStateChannel(channel, TEST_STORE_MINIMAL_TX, TEST_STORE_SET_STATE_COMMITMENT),
      store2.createStateChannel(channel, TEST_STORE_MINIMAL_TX, TEST_STORE_SET_STATE_COMMITMENT),
    ]);
    const [res1, res2] = await Promise.all([
      store1.getStateChannel(channel.multisigAddress),
      store2.getStateChannel(channel.multisigAddress),
    ]);
    expect(res1).to.deep.eq(channel);
    expect(res2).to.deep.eq(channel);
  });

});
