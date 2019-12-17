import { CFCoreTypes } from "@connext/types";

class MockMessagingService implements CFCoreTypes.IMessagingService {
  async send() {}
  onReceive() {}
}

export default new MockMessagingService();
