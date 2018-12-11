import {BROWSER_NOT_SUPPORTED_TEXT} from '../frame/constants'
import wait from './wait'

const WORKER_FILENAME = '/workerRunner.js'
const WORKER_FILENAME_LS_KEY = 'workerFilename'

export interface ServiceWorkerClient {
  load: (serviceWorker: ServiceWorker) => void
  unload: () => Promise<void>
}

function activate (client: ServiceWorkerClient, serviceWorker: ServiceWorker) {
  if (serviceWorker.state === 'activated') {
    client.load(serviceWorker)
  }
}

function install (client: ServiceWorkerClient, registration: ServiceWorkerRegistration) {
  let serviceWorker = (registration.active || registration.installing)!

  serviceWorker.onstatechange = () => {
    if (serviceWorker.state === 'redundant') {
      client.unload().catch(console.error.bind(console))
      return
    }

    activate(client, serviceWorker)
  }

  activate(client, serviceWorker)
}

async function handleRegistration (client: ServiceWorkerClient, registration: ServiceWorkerRegistration) {
  const lastWorkerFilename = localStorage.getItem(WORKER_FILENAME_LS_KEY)

  if (lastWorkerFilename !== WORKER_FILENAME) {
    await registration.update()
  }

  await install(client, registration)
  localStorage.setItem(WORKER_FILENAME_LS_KEY, WORKER_FILENAME)
}

export function register (client: ServiceWorkerClient) {
  if (!navigator.serviceWorker) {
    throw new Error(BROWSER_NOT_SUPPORTED_TEXT)
  }

  let p = Promise.resolve<any>(null) as any

  // need this so that in dev we can always see console logs + network requests
  // originating from the worker and can refresh the page to see latest changes.
  if (process.env.NODE_ENV !== 'production') {
    p = navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length) {
        console.log('Force unregistering workers.')
        // note that the below wait() gives the page time to close
        // itself before reloading. without it, we get an infinite loop.
        return Promise.all(registrations.map((r) => r.unregister()))
          .then(() => location.reload())
          .then(() => wait(1000) as any)
      }
    })
  }

  p.then(() => navigator.serviceWorker.register(WORKER_FILENAME, {scope: './'}))
    .then((registration: ServiceWorkerRegistration) => handleRegistration(client, registration))
    .catch((error: any) => console.error(error))
}
