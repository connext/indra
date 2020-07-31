import { Controller, Get, Options, Post, Body, Param, BadRequestException } from "@nestjs/common";
import prometheus, { collectDefaultMetrics, LabelValues, Histogram, Registry } from "prom-client";
import { ConfigService } from "./config/config.service";

export interface Metrics {
  client: typeof prometheus;
  registry: Registry;
}

export const createMetrics = (): Metrics => {
  // Collect default metrics (event loop lag, memory, file descriptors etc.)
  collectDefaultMetrics();

  return { client: prometheus, registry: prometheus.register };
};

@Controller("")
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get("/metrics")
  async getMetrics(): Promise<string> {
    collectDefaultMetrics();
    return prometheus.register.metrics();
  }

  @Options("")
  async noop(): Promise<void> {
    return;
  }
}
