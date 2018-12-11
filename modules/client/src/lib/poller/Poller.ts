export interface Poller {
  start: (cb: Function, intervalLength: number) => void
  stop: () => void 
  isStarted: () => boolean
}
