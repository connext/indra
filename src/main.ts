import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

const FirebaseServer = require("firebase-server");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);

  const firebase = new FirebaseServer(5555, "localhost");
  process.on("SIGINT", async () => {
    console.log("Shutting down playground-server...");
    firebase.close();
    process.exit(0);
  });
}
bootstrap();
