import { ConnextStore } from "../state/store"

export default function getAddress(store: ConnextStore): string {
  return store.getState().runtime.wallet!.getAddressString()
}
