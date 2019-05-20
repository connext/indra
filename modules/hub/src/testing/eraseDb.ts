import { Client } from 'pg'

import DBEngine from '../DBEngine'

export default async function eraseDb (engine: DBEngine<Client>): Promise<any> {
  return engine.exec(truncateAllTables)
}

export async function truncateAllTables(cxn: Client) {
  const tables = await cxn.query(`
    SELECT 'TRUNCATE ' || table_name || ' RESTART IDENTITY CASCADE;' as q FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';
  `)

  for (let t of tables.rows)
    await cxn.query(t.q)
}
