import JsonRpcServer from './messaging/JsonRpcServer'

export interface Metric {
  name: string
  ts: Date
  data: any
}

let pendingMetrics: Metric[] = []
let logFunc: any = null

export function setLogFunc(func: (metrics: Metric[]) => void) {
  logFunc = func
  if (pendingMetrics.length > 0) {
    logFunc(pendingMetrics)
    pendingMetrics = []
  }
}

export function logMetrics(metrics: Metric[]) {
  if (logFunc) {
    logFunc(metrics)
  } else {
    pendingMetrics.push.apply(pendingMetrics, metrics)
  }
}

function logMetric(name: string, data: any) {
  logMetrics([{
    name: name,
    ts: new Date(),
    data,
  }])
}

export function timed<T>(name: string, p: Promise<T>, meta?: any): Promise<T> {
  let start = new Date()
  p
    .then(() => logMetric(name, {
      ...meta,
      duration: (+(new Date()) - +start) / 1000,
      success: true,
    }))
    .catch(e => logMetric(name, {
      ...meta,
      duration: (+(new Date()) - +start) / 1000,
      error: '' + e,
    }))
  return p
}

export function logMetricWorker(server: JsonRpcServer, name: string, data: any) {
  server.broadcast('__METRICS__', [{
    name: `vynos:${name}`,
    ts: new Date(),
    data
  }])
}
