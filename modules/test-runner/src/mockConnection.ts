import { IConnextClient } from "@connext/types";

class MockConnection {
  private connected: boolean = true;
  private channel: IConnextClient;

  constructor(channel: IConnextClient) {
    this.channel = channel;
  }

  public send(payload: any): Promise<any> {
    if (!this.connected) {
      return Promise.resolve();
    }
    return this.channel.channelProvider.send((payload.method, payload.params));
  }

  public open(): void {
    this.connected = true;
  }

  public close(): void {
    this.connected = false;
  }
}

export default MockConnection;
