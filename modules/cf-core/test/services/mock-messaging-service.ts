import { Node } from "@connext/cf-types";

class MockMessagingService implements Node.IMessagingService {
  async send() {}
  onReceive() {}
}

export default new MockMessagingService();
