import { IMessagingService } from "@connext/messaging";
import { RpcException } from "@nestjs/microservices";

import { CLogger } from "./logger";

const logger = new CLogger("MessagingProvider");

export interface IMessagingProvider {
  setupSubscriptions(): void;
}

export abstract class AbstractMessagingProvider implements IMessagingProvider {
  constructor(protected readonly messaging: IMessagingService) {}

  async connectRequestReponse(
    pattern: string,
    processor: (subject: string, data: any) => any,
  ): Promise<void> {
    // TODO: timeout
    await this.messaging.subscribe(pattern, async (msg: any) => {
      if (msg.reply) {
        try {
          const response = await processor(msg.subject, msg.data);
          this.messaging.publish(msg.reply, {
            err: null,
            response,
          });
        } catch (e) {
          this.messaging.publish(msg.reply, {
            err: `Error during processor function: ${processor.name}`,
            message: `Error during processor function: ${processor.name}`,
          });
          logger.error(JSON.stringify(e, null, 2));
        }
      }
    });
    logger.log(`Connected message pattern "${pattern}" to function ${processor.name}`);
  }

  abstract setupSubscriptions(): void;
}
