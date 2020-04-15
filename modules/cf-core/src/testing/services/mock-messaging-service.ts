export class MockMessagingService {
  async send() {}
  async onReceive() {}
}

export const mockMessagingService = new MockMessagingService();
