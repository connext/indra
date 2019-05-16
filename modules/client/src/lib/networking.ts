export const GET = 'GET'
export const POST = 'POST'

export class Networking {
  public baseUrl: string

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  public get = (url: string): Promise<any> =>
    this.request(url, GET)

  public post = (url: string, body: any): Promise<any> =>
    this.request(url, POST, body)

  private request = async (url: string, method: any, body?: any): Promise<any> => {
    // TO DO: better type
    const opts = {
      method,
    } as any

    let res
    if (method === POST) {
      opts.body = JSON.stringify(body)
      opts.headers = {
        'Content-Type': 'application/json',
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
