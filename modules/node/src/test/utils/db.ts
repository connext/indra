import { Connection } from "typeorm";

export const clearDb = async (connection: Connection): Promise<void> => {
  await connection.synchronize(true);
};
