import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  const msg = await nc.request("hello", 1000, JSON.stringify({ data: "Hello, Indra", id: "myid" }));
  console.log("msg: ", msg);
  await nc.subscribe("exchange-rate", (err: any, msg: any) => {
    if (err) {
      console.log(err);
    } else {
      console.log(msg);
      console.log(msg.data);
    }
  });
}

start();
