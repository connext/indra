import { MockStore, MockConnextInternal, MockHub } from '../testing/mocks';
import { mkAddress, assertChannelStateEqual, getThreadState, mkHash, getChannelState } from '../testing';
import { assert } from '../testing'
import { SyncResult, ThreadStateUpdate } from '@src/types';
// @ts-ignore
global.fetch = require('node-fetch-polyfill');

/*
StateUpdateController is used by all the other controllers to handle various types of state updates that are present in the `runtime.syncResultsFromHub` state. To do this, it subscribes to the store, and handles the the updates from the hub in the `handleSyncItem` method. As it is an internal controller with no public API there are no unit tests written.
*/

describe.skip('StateUpdateController: unit tests', () => {
  const user = mkAddress('0xUUU')
  let connext: MockConnextInternal
  const mockStore = new MockStore()

  let initialChannel = getChannelState("empty", {
    user,
    balanceWei: [10, 10],
    balanceToken: [10, 10],
    txCount: [1, 1],
  })

  beforeEach(async () => {
    connext = new MockConnextInternal({ user, })
    mockStore.setChannel(initialChannel)
  })

  afterEach(async () => {
    await connext.stop()
  })
})