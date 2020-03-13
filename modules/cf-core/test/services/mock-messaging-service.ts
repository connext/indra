import { IMessagingService } from "@connext/types";

class MockMessagingService implements IMessagingService {
  async send() {}
  onReceive() {}
}

export default new MockMessagingService();
