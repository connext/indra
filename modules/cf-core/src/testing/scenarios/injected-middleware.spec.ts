import {
  Opcode,
  ProtocolName,
  ProtocolNames,
  ProtocolRoles,
  SetupMiddlewareContext,
  ValidationMiddleware,
  EventNames,
} from "@connext/types";
import { CFCore } from "../../cfCore";
import { getCreate2MultisigAddress } from "../../utils";

import { expect } from "../assertions";
import { SetupContext, setup } from "../setup";
import { assertMessage, createChannel, getChainId } from "../utils";

describe("injected validation middleware", () => {
  let nodeA: CFCore;
  let nodeB: CFCore;

  let multisigAddress: string;
  let chainId;

  beforeEach(async () => {
    const context: SetupContext = await setup(global);
    chainId = getChainId();
    nodeA = context["A"].node;
    nodeB = context["B"].node;

    multisigAddress = await getCreate2MultisigAddress(
      nodeA.publicIdentifier,
      nodeB.publicIdentifier,
      nodeA.networkContexts[chainId].contractAddresses,
      nodeA.networkContexts[chainId].provider,
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
    expect(capturedProtocol!).to.eq(ProtocolNames.setup);
    expect(capturedContext!).to.deep.eq({
      params: {
        initiatorIdentifier: nodeA.publicIdentifier,
        responderIdentifier: nodeB.publicIdentifier,
        multisigAddress,
        chainId,
      },
      role: ProtocolRoles.initiator,
    });
  });

  it("protocol will fail if the validation middleware errors", async () => {
    const initiatorFailure = `Counterparty execution of setup failed: Error: Middleware failed`;
    const FAILURE_MESSAGE = "Middleware failed";
    const middleware: any = (protocol: any, context: any) => {
      throw new Error(FAILURE_MESSAGE);
    };
    nodeB.injectMiddleware(Opcode.OP_VALIDATE, middleware);
    await Promise.all([
      new Promise(async (resolve) => {
        await expect(createChannel(nodeA, nodeB)).to.eventually.be.rejectedWith(initiatorFailure);
        resolve();
      }),
      new Promise((resolve) => {
        nodeB.once(EventNames.SETUP_FAILED_EVENT, async (msg) => {
          assertMessage(
            msg,
            {
              from: nodeA.publicIdentifier,
              data: {
                params: {
                  responderIdentifier: nodeB.publicIdentifier,
                  initiatorIdentifier: nodeA.publicIdentifier,
                },
              },
              type: EventNames.SETUP_FAILED_EVENT,
            },
            ["data.params.multisigAddress", "data.error"],
          );
          expect(msg.data.error.includes(FAILURE_MESSAGE)).to.eq(true);
          resolve();
        });
      }),
      new Promise((resolve) => {
        nodeA.once(EventNames.SETUP_FAILED_EVENT, async (msg) => {
          assertMessage(
            msg,
            {
              from: nodeA.publicIdentifier,
              data: {
                params: {
                  responderIdentifier: nodeB.publicIdentifier,
                  initiatorIdentifier: nodeA.publicIdentifier,
                },
              },
            },
            ["data.params.multisigAddress", "data.error"],
          );
          expect(msg.data.error.includes(initiatorFailure)).to.eq(true);
          resolve();
        });
      }),
    ]);
  });
});
