import getLogger, {SCLogger} from './logging'

export default function log(namespace: string): SCLogger {
  return getLogger('payment-hub', namespace)
}
