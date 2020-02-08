import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const req = await nc.request("hello", 10000, JSON.stringify({ id: "myid2" }));
  console.log("req: ", req);
}

start();
