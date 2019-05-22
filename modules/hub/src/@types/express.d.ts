import * as express from 'express'

declare module 'express' {
   export interface Request {
     address: string
     getText(): Promise<string>
     getRawBody(): Promise<Buffer>
     roles: Set
   }
}
