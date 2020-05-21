import { Opcode } from "@connext/types";

import { Deferred } from "../deferred";

import { MiniNode } from "./mininode";
import { StateChannel } from "../models";

export class MessageRouter {
  // mapping from a mininode's address to the mininode
  private readonly nodesMap: Map<string, MiniNode>;

  // mapping from a mininode's address to a promise representing the future value
  // of an IO_SEND_AND_WAIT call. It is expected that the protocol is awaiting
  // on this promise.
  private readonly deferrals: Map<string, Deferred<any>>;

  // when a message from a mininode causes a protocol to run in another node,
  // a promise representing completion of the second protocol is added here.
  private readonly pendingPromises: Set<Promise<void>>;

  constructor(nodes: MiniNode[]) {
    this.nodesMap = new Map();
    this.deferrals = new Map();
    this.pendingPromises = new Set();

    for (const node of nodes) {
      this.nodesMap.set(node.publicIdentifier, node);

      node.protocolRunner.register(Opcode.IO_SEND, (args: [any, StateChannel]) => {
        const [message, channel] = args;
        this.appendToPendingPromisesIfNotNull(this.routeMessage(message, channel));
        return { channel };
      });
      node.protocolRunner.register(Opcode.IO_SEND_AND_WAIT, async (args: [any, StateChannel]) => {
        const [message, channel] = args;
        message.fromAddress = node.publicIdentifier;

        this.deferrals.set(node.publicIdentifier, new Deferred());
        this.appendToPendingPromisesIfNotNull(this.routeMessage(message, channel));
        const ret = await this.deferrals.get(node.publicIdentifier)!.promise;
        this.deferrals.delete(node.publicIdentifier);

        return { data: ret, channel };
      });
    }
  }

  private appendToPendingPromisesIfNotNull(v: Promise<void> | null) {
    if (v === null) return;
    this.pendingPromises.add(v);
  }

  private routeMessage(message: any, channel: StateChannel) {
    const { to } = message;
    if (typeof to === "undefined") {
      throw new Error("No to found on message");
    }
    const deferred = this.deferrals.get(to);

    if (typeof deferred === "undefined") {
      const toNode = this.nodesMap.get(to);
      if (typeof toNode === "undefined") {
        throw new Error(`No node with id = ${to} found`);
      }

      // This returns a promise that resolves when runProtocolWithMessage
      // finishes
      return toNode.dispatchMessage(message, channel);
    }

    deferred.resolve(message);
    return null;
  }

  public async waitForAllPendingPromises() {
    await Promise.all(this.pendingPromises);
    if (this.deferrals.size !== 0) {
      throw new Error("Pending IO_SEND_AND_WAIT deferrals detected");
    }
  }
}
