import * as express from 'express'

declare module 'express' {
   export interface Request {
      getText: () => Promise<string>
      getRawBody: () => Promise<Buffer>
   }
}
