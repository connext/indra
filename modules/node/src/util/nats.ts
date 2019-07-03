import { RpcException } from "@nestjs/microservices";
import { Client, Msg, NatsError } from "ts-nats";

import { CLogger } from "./logger";

const logger = new CLogger("NatsProvider");

export abstract class AbstractNatsProvider implements INatsProvider {
  constructor(protected readonly natsClient: Client) {}

  async connectRequestReponse(
    pattern: string,
    processor: (subject: string, data: any) => any,
  ): Promise<void> {
    // TODO: timeout
    await this.natsClient.subscribe(pattern, async (err: NatsError | null, msg: Msg) => {
      if (err) {
        throw new RpcException(`Error processing message: ${JSON.stringify(msg)}.`);
      } else if (msg.reply) {
        try {
          const publish = await processor(msg.subject, msg.data);
          this.natsClient.publish(
            msg.reply,
            // TODO: make this a type
            { data: publish, status: "success" },
          );
        } catch (e) {
          this.natsClient.publish(
            msg.reply,
            // todo make this a type
            JSON.stringify({
              message: `Error during processor function: ${processor.name}`,
              status: "success",
            }),
          );
        }
      }
    });
    logger.log(`Connected message pattern "${pattern}" to function ${processor.name}`);
  }

  abstract setupSubscriptions(): void;
}

export interface INatsProvider {
  setupSubscriptions(): void;
}
