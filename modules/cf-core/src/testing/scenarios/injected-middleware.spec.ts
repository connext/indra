import {
  Opcode,
  ProtocolName,
  ProtocolNames,
  ProtocolRoles,
  SetupMiddlewareContext,
  ValidationMiddleware,
} from "@connext/types";
import { Node } from "../../node";
import { getCreate2MultisigAddress } from "../../utils";

import { SetupContext, setup } from "../setup";
import { createChannel } from "../utils";

describe("injected validation middleware", () => {
  let nodeA: Node;
  let nodeB: Node;

  let multisigAddress: string;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    nodeA = context["A"].node;
    nodeB = context["B"].node;

    multisigAddress = await getCreate2MultisigAddress(
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
      {
        proxyFactory: nodeA.networkContext.ProxyFactory,
        multisigMastercopy: nodeA.networkContext.MinimumViableMultisig,
      },
      nodeA.networkContext.provider,
    );
  });

  it("can inject validation middleware", async () => {
    let capturedProtocol: ProtocolName;
    let capturedContext: SetupMiddlewareContext;
    const middleware: ValidationMiddleware = async (
      protocol: ProtocolName,
      context: SetupMiddlewareContext,
    ) => {
      capturedContext = { ...context };
      capturedProtocol = protocol;
    };
    nodeA.injectMiddleware(Opcode.OP_VALIDATE, middleware);
    await createChannel(nodeA, nodeB);
    expect(capturedProtocol!).toBe(ProtocolNames.setup);
    expect(capturedContext!).toEqual({
      params: {
        initiatorXpub: nodeA.publicIdentifier,
        responderXpub: nodeB.publicIdentifier,
        multisigAddress,
      },
      role: ProtocolRoles.initiator,
    });
  });

  it("protocol will fail if the validation middleware errors", async () => {
    const FAILURE_MESSAGE = "Middleware failed";
    const middleware: ValidationMiddleware = (protocol, context) => {
      return Promise.reject(FAILURE_MESSAGE);
    };
    nodeA.injectMiddleware(Opcode.OP_VALIDATE, middleware);
    await expect(createChannel(nodeA, nodeB)).rejects.toEqual(FAILURE_MESSAGE);
  });
});
