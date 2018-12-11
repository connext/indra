import {IDebugger} from 'debug'

const d = require('debug')

if (process.env.DEBUG) {
  d.enable('SpankWallet:*')
}

export default function debug(namespace: string): IDebugger {
  const res = () => {}
  return res as any
}
