import { NodeApiClient } from "./node";
import { MockMessagingService, nodeUrl } from "./testing/mocks";
import { INodeApiClient } from "./types";

describe("NodeApiClient", () => {
  let nodeClient: INodeApiClient;

  beforeEach(() => {
    nodeClient = new NodeApiClient({
      messaging: new MockMessagingService(),
    });
    expect(nodeClient).toBeInstanceOf(NodeApiClient);
  });

  test.skip("should call the config method properly", async () => {
    jest.spyOn(nodeClient, "config");
    const message = await nodeClient.config();
    expect(nodeClient.config).toBeCalledTimes(1);
    expect(message).toStrictEqual({
      chainId: "mocks", // network that your channel is on
      nodePublicIdentifier: "x-pubcooolstuffs", // x-pub of node
      nodeUrl,
    });
  });
});
