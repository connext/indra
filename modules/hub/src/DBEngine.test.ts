import { Context } from "./Container"
import { getTestConfig, TestServiceRegistry, assert } from './testing'
import { PostgresDBEngine, SQL, default as DBEngine } from "./DBEngine"

const logLevel = 0

describe('DBEngine', () => {
  const registry = new TestServiceRegistry({ logLevel })

  describe('SQL formatter', () => {
    const db: PostgresDBEngine = registry.get('DBEngine')
    it('should work', async () => {
      const res = await db.query(SQL`select coalesce(${null}, ${"fo'oo"}) as x`)
      assert.containSubset(res.rows[0], { x: "fo'oo" })
    })
  })

  describe('withTransaction', () => {
    const db: PostgresDBEngine = registry.get('DBEngine')
    after(() => db.query('drop table tx_test;'))
    before(() => db.query('create table tx_test(foo integer)'))
    beforeEach(async () => {
      await db.query('truncate table tx_test')
      await db.query('insert into tx_test values (1)')
    })

    async function assertRows(expected: number[], cxn?: DBEngine) {
      cxn = cxn || db
      // Insert one more row to make sure the database is in a clean state
      await cxn.query('insert into tx_test values (999)')
      const res = await cxn.query('select * from tx_test where foo < 999 order by foo')
      assert.deepEqual(res.rows.map(r => r.foo), expected)
    }

    it('returns correct value', async () => {
      assert.equal(await db.withTransaction(async cxn => 69), 69)
    })

    it('should commit', async () => {
      await db.withTransaction(async cxn => {
        await cxn.query('insert into tx_test values (2)')
      })
      await assertRows([1, 2])
    })

    it('should rollback', async () => {
      await assert.isRejected(db.withTransaction(async cxn => {
        await cxn.query('insert into tx_test values (2)')
        throw new Error('expected error')
      }), /expected error/)

      await assertRows([1])
    })

    it('nested should work with savepoints', async () => {
      await db.withTransaction(async cxn1 => {
        await cxn1.query('insert into tx_test values (2)')

        await cxn1.withTransaction({ savepoint: true }, async cxn2 => {
          await cxn2.query('insert into tx_test values (3)')
        })

        await assert.isRejected(cxn1.withTransaction({ savepoint: true }, async cxn2 => {
          await cxn2.query('insert into tx_test values (4)')
          throw new Error('expected error')
        }), /expected error/)

        await cxn1.query('insert into tx_test values (5)')
      })

      await assertRows([1, 2, 3, 5])
    })

    it('nested should work without savepoints happy', async () => {
      await db.withTransaction(async cxn1 => {
        await cxn1.query('insert into tx_test values (2)')

        await cxn1.withTransaction({ savepoint: false }, async cxn2 => {
          await cxn2.query('insert into tx_test values (3)')
        })

        await cxn1.query('insert into tx_test values (4)')
      })

      await assertRows([1, 2, 3, 4])
    })

    it('nested should work without savepoints exception', async () => {
      await db.withTransaction(async cxn1 => {
        await cxn1.query('insert into tx_test values (2)')

        await assert.isRejected(cxn1.withTransaction({ savepoint: false }, async cxn2 => {
          await cxn2.query('insert into tx_test values (3)')
          throw new Error('expected error')
        }), /expected error/)

        await assert.isRejected(cxn1.query('insert into tx_test values (4)'), /current transaction is aborted/)
      })

      await assertRows([1])
    })

    it('should be isolated', async () => {
      await db.withTransaction(async cxn => {
        await cxn.query('insert into tx_test values (2)')
        await db.withFreshConnection(async cxn => {
          await cxn.query('insert into tx_test values (3)')
          await assertRows([1, 3], cxn)
        })
      })
      await assertRows([1, 2, 3])
    })

    describe('using the transaction from Context', () => {
      const context = new Context()
      const db2: PostgresDBEngine = registry.get('DBEngine', { Context: context })
      const db3: PostgresDBEngine = registry.get('DBEngine', { Context: context })

      it('should be set and cleared', async () => {
        await db2.withTransaction(async cxn2 => {
          assert.strictEqual(context.get('pgTransaction'), cxn2)
        })
        assert.strictEqual(context.get('pgTransaction'), null)
      })

      it('should be shared', async () => {
        await db2.withTransaction(async cxn2 => {
          await db3.withTransaction(async cxn3 => {
            assert.strictEqual(cxn2, cxn3)
          })
          assert.strictEqual(context.get('pgTransaction'), cxn2)
        })
        assert.strictEqual(context.get('pgTransaction'), null)
      })
    })

  })
})

