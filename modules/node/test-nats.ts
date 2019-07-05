import { connect } from "ts-nats";

async function start(): Promise<void> {
  const nc = await connect({ servers: ["nats://localhost:4222"] });
  await nc.subscribe("exchange-rate", (err, msg) => {
    if (err) {
      console.log(err);
    } else {
      console.log(msg);
      console.log(msg.data);
    }
  });
}

start();
