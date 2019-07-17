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
          this.messaging.publish(msg.reply, {
            err: null,
            response: await processor(msg.subject, msg.data),
          });
        } catch (e) {
          this.messaging.publish(msg.reply, {
            message: `Error during processor function: ${processor.name}`,
            response: {
              err: `Error during processor function: ${processor.name}`,
            },
          });
        }
      }
    });
    logger.log(`Connected message pattern "${pattern}" to function ${processor.name}`);
  }

  abstract setupSubscriptions(): void;
}
