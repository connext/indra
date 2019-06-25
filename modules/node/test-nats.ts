import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const msg = await nc.request("config.get", 1000);
  console.log("msg: ", msg);
}

start();
