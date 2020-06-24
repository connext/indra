import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const req = await nc.request(
    "channel.gettest.xpub6DXwZMmWUq4bRZ3LtaBYwu47XV4Td19pnngok2Y7DnRzcCJSKCmD1AcLJDbZZf5dzZpvHqYzmRaKf7Gd2MV9qDvWwwN7VpBPNXQCZCbfyoK",
    10000,
    JSON.stringify({ id: "myid2", data: { hello: "world" } }),
  );
}

start();
