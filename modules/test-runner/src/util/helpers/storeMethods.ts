import { Store, StorePair } from "@connext/types";

const TEST_STORE_PAIR: StorePair = { path: "testing", value: "something" };

export async function setAndGet(
  store: Store,
  storePair: StorePair = TEST_STORE_PAIR,
): Promise<void> {
  await store.set([storePair]);
  const value = await store.get(storePair.path);

  expect(value).toEqual(storePair.value);
}
