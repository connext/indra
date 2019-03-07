export default async function requestJson<T> (url: RequestInfo, options?: RequestInit): Promise<T> {
  const res = await request(url, {
    ...options,
    method: (options && options.method) || 'GET',
    credentials: 'include',
    mode: 'cors'
  })
  return res.json() as Promise<T>
}

export function postJson<T> (url: RequestInfo, body?: any, options: RequestInit = {}): Promise<T> {
  const opts = {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  if (body) {
    opts.body = JSON.stringify(body)
  }

  return requestJson(url, opts)
}

export async function request (url: RequestInfo, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options)

  if (res.status < 200 || res.status > 299) {
    throw new Error(`Failed to fetch URL: ${url}. Got status: ${res.status}`)
  }

  return res
}
