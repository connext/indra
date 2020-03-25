import { MessagingService } from "@connext/messaging";
import { RpcException } from "@nestjs/microservices";

import { LoggerService } from "../logger/logger.service";
import { isXpub } from "./validate";

export interface IMessagingProvider {
  setupSubscriptions(): void;
}

export abstract class AbstractMessagingProvider implements IMessagingProvider {
  constructor(public readonly log: LoggerService, protected readonly messaging: MessagingService) {
    this.log.setContext("MessagingInterface");
  }

  getPublicIdentifierFromSubject(subject: string): string {
    const pubId = subject.split(".").pop(); // last item of subscription is pubId
    if (!pubId || !isXpub(pubId)) {
      throw new RpcException("Invalid public identifier in message subject");
    }
    return pubId;
  }

  async connectRequestReponse(
    pattern: string,
    processor: (subject: string, data: any) => any,
  ): Promise<void> {
    // TODO: timeout
    await this.messaging.subscribe(pattern, async (msg: any) => {
      this.log.debug(
        `Got NATS message for subject ${msg.subject} with data ${JSON.stringify(msg.data)}`,
      );
      if (msg.reply) {
        try {
          const start = Date.now();
          const subject = msg.subject;
          const response = await processor(msg.subject, msg.data);
          const diff = Date.now() - start;
          if (diff >= 10 && diff < 100) {
            this.log.info(`Responded to ${subject} in ${diff} ms`);
          } else if (diff >= 100 && diff < 1000) {
            this.log.warn(`Responded to ${subject} in ${diff} ms`);
          } else if (diff >= 1000) {
            this.log.error(`Responded to ${subject} in ${diff} ms`);
          }
          this.messaging.publish(msg.reply, {
            err: null,
            response,
          });
        } catch (e) {
          this.messaging.publish(msg.reply, {
            err: e ? e.toString() : e,
            message: `Error during processor function: ${processor.name}`,
          });
          this.log.error(`Error processing message ${msg.subject}: ${e.message}`, e.stack);
        }
      }
    });
    this.log.info(`Connected message pattern "${pattern}" to function ${processor.name}`);
  }

  abstract setupSubscriptions(): void;
}
