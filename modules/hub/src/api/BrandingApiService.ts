import * as express from 'express'
import { ApiService } from './ApiService'
import Config from '../Config'

export default class BrandingApiService extends ApiService<BrandingApiServiceHandler> {
  namespace = 'branding'
  routes = {
    'GET /': 'doBranding',
  }
  handler = BrandingApiServiceHandler
  dependencies = {
    config: 'Config',
  }
}

class BrandingApiServiceHandler {
  config: Config

  doBranding(req: express.Request, res: express.Response) {
    res.send({
      title: this.config.branding.title || '',
      companyName: this.config.branding.companyName || '',
      backgroundColor: this.config.branding.backgroundColor || '',
      textColor: this.config.branding.textColor || '',
      address: this.config.recipientAddress
    })
  }
}
