import { revertEVMSnapshot } from "./util";

// TODO: don't hardcode this
const PRE_TEST_SNAPSHOT_ID = "0x1";

export default async function(): Promise<void> {
  try {
    await revertEVMSnapshot(PRE_TEST_SNAPSHOT_ID);
    console.log(`Reverted snapshot to ${PRE_TEST_SNAPSHOT_ID}`);
  } catch (e) {
    console.log(`Uh oh, EVM revert didn't work: ${e.toString()}`);
  }
}
