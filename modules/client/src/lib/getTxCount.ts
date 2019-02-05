import { ConnextStore } from "../state/store"

export default function getTxCount(store: ConnextStore) {
  return store.getState().persistent.channel.txCountGlobal
}
