import { Connection } from "typeorm";

import { viewEntites } from "../app.module";

export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}

export function getEntities(connection: Connection) {
  const entities: { name: string; tableName: string }[] = [];
  connection.entityMetadatas.forEach(x => {
    if (viewEntites.map(v => v.name).indexOf(x.name) !== -1) {
      return;
    }
    entities.push({ name: x.name, tableName: x.tableName });
  });
  return entities;
}

export async function cleanAll(
  entities: { name: string; tableName: string }[],
  connection: Connection,
) {
  for (const entity of entities) {
    await connection.query(`DELETE FROM "${entity.tableName}";`);
  }
}

export async function clearDb(connection: Connection) {
  const entities = getEntities(connection);
  await cleanAll(entities, connection);
}
