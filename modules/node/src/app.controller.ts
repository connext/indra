import { Controller, Get, Options } from "@nestjs/common";
import prometheus from "prom-client";

@Controller("")
export class AppController {
  @Get("/metrics")
  async getMetrics(): Promise<string> {
    return prometheus.register.metrics();
  }

  @Options("")
  async noop(): Promise<void> {
    return;
  }
}
