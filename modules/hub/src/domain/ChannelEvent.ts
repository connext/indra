import {ContractEvent} from './ContractEvent'

export default interface ChannelEvent {
  ts: number
  sender: string
  contract: string
  contractEvent: ContractEvent
}
