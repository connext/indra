import { Router as IRouter } from 'express'

import { Container, Context } from '../Container'

export { Request, Response } from 'express'
export const Router = require('express-promise-router')
export type Router = IRouter

export abstract class ApiService<Handler=any> {
  abstract namespace: string
  abstract routes: any
  abstract handler: any
  abstract dependencies: { [N in keyof Handler]?: string }

  container: Container

  constructor(container: Container) {
    this.container = container
  }

  getRouter() {
    const router = new Router()
    Object.entries(this.routes).forEach(([route, handlerMethod]) => {
      if (!((handlerMethod as string) in this.handler.prototype)) {
        throw new Error(`"${handlerMethod}" does not exist on "${this.handler}"`)
      }
      let [method, path, rest] = route.split(/\s+/)
      if (rest) {
        throw new Error(`Invalid path (too many parts): ${route}`)
      }
      method = method.toLowerCase()
      router[method](path, this.handleRequest.bind(this, handlerMethod))
    })
    return router
  }

  getHandler() {
    const handler = new this.handler()
    const context = new Context()
    Object.entries(this.dependencies).forEach(([name, service]) => {
      handler[name] = this.container.resolve(service as string, {
        'Context': context,
      })
    })
    return handler
  }

  handleRequest(handlerMethod: string, req: Request, res: Response) {
    const handler = this.getHandler()
    return handler[handlerMethod](req, res)
  }

}
