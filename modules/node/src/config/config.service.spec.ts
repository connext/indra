import { ConfigService } from "./config.service";
import { LoggerService } from "../logger/logger.service";

describe("ConfigService", () => {
    const configService = new ConfigService(
      new LoggerService()
    );;

    it("can getPort", () => {
        const port = configService.getPort();
        console.log(`Port: ${port}`)
    })
})
