export const GET = 'GET'
export const POST = 'POST'

export class Networking {
  public baseUrl: string
  private address: string | undefined
  private nonce: string | undefined
  private signature: string | undefined

  public constructor(baseUrl: string, address?: string, nonce?: string, signature?: string) {
    this.baseUrl = baseUrl
    this.address = address || undefined
    this.nonce = nonce || undefined
    this.signature = signature || undefined
  }

  public get = (url: string): Promise<any> =>
    this.request(url, GET)

  public post = (url: string, body: any): Promise<any> =>
    this.request(url, POST, body)

  private request = async (url: string, method: any, body?: any): Promise<any> => {
    const opts = { method } as any

    let res
    if (method === POST) {
      opts.body = JSON.stringify(body)
      opts.headers = {
        'Content-Type': 'application/json',
      }
      if (this.nonce && this.signature) {
        opts.headers['x-address'] = this.address
        opts.headers['x-nonce'] = this.nonce
        opts.headers['x-signature'] = this.signature
      }
    }
    opts.mode = 'cors'
    opts.credentials = 'include'
    res = await fetch(`${this.baseUrl}/${url}`, opts)

    if (res.status < 200 || res.status > 299) {
      let text
      try {
        text = await res.text()
      } catch (e) {
        text = res.statusText
      }


      throw errorResponse(
        res.status,
        res.body,
        `Received non-200 response: ${text}`,
      )
    }

    if (res.status === 204) {
      return {
        data: undefined,
      }
    }

    const data = await res.json()

    return {
      data,
    }
  }
}

export const errorResponse = (status: number, body: any, message: string): any => ({
  body,
  message,
  status,
})
