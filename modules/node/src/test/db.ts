import { Connection } from "typeorm";

export async function clearDb(connection: Connection): Promise<void> {
  await connection.synchronize(true);
}
