export class TipDto {
  streamId: string
  streamName: string
  performerId: string
  performerName: string
  performerAddress: string
  tipperName: string
  createdAt: number
  type: 'TIP'
}

export class Tip {
  id: number
  streamId: string
  streamName: string
  performerId: string
  performerName: string
  performerAddress: string
  tipperName: string
  createdAt: number
}
