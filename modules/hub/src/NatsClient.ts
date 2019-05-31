import {connect, NatsConnectionOptions, Client} from 'ts-nats';

export type NatsClient = Client

export async function getNatsClient(options?: NatsConnectionOptions): Promise<NatsClient> {
    var nc: NatsClient
    try {
        nc = await connect(options) as NatsClient;
    } catch (ex) {
        // TODO: log error
    }
    return nc
}
