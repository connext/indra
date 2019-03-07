import { assert } from 'chai'
import DoublyLinkedList from './DoublyLinkedList'

describe('DoublyLinkedList', () => {
  let dll: DoublyLinkedList<string>

  beforeEach(() => {
    dll = new DoublyLinkedList<string>()
    dll.push('foo')
    dll.push('bar')
    dll.push('baz')
    dll.push('quux')
  })

  it('should have a length', () => {
    assert.strictEqual(dll.length(), 4)
  })

  it('should support getting items at indices', () => {
    assert.strictEqual(dll.at(2), 'baz')
  })

  it('should return first item', () => {
    assert.strictEqual(dll.first(), 'foo')
  })

  it('should return last item', () => {
    assert.strictEqual(dll.last(), 'quux')
  })

  it('should allow iteration', () => {
    const values: string[] = []
    dll.iterate((item: string, remove: () => void) => values.push(item))
    assert.deepEqual(values, ['foo', 'bar', 'baz', 'quux'])
  })

  it('should allow mapping', () => {
    const values = dll.map<string>((item: string, remove: () => void) => (item + '1'))
    assert.deepEqual(values, ['foo1', 'bar1', 'baz1', 'quux1'])
  })

  it('should support removal during iteration', () => {
    dll.iterate((item: string, remove: () => void) => {
      if (item === 'bar') {
        remove()
      }
    })

    assert.strictEqual(dll.length(), 3)
    assert.strictEqual(dll.at(0), 'foo')
    assert.strictEqual(dll.at(1), 'baz')
    assert.strictEqual(dll.at(2), 'quux')
  })

  it('should throw an error for out-of-bounds indices', () => {
    assert.throws(() => {
      dll.at(900)
    })
  })

  describe('edge cases', () => {
    it('should work when removing the first of two items', () => {
      dll = new DoublyLinkedList<string>()
      dll.push('foo')
      dll.push('bar')
      dll.remove(0)
      assert.strictEqual(dll.first(), 'bar')
      assert.strictEqual(dll.last(), 'bar')
      assert.strictEqual(dll.length(), 1)
    })

    it('should work when removing the last of two items', () => {
      dll = new DoublyLinkedList<string>()
      dll.push('foo')
      dll.push('bar')
      dll.remove(1)
      assert.strictEqual(dll.first(), 'foo')
      assert.strictEqual(dll.last(), 'foo')
      assert.strictEqual(dll.length(), 1)
    })

    it('should work when removing the only item', () => {
      dll = new DoublyLinkedList<string>()
      dll.push('foo')
      dll.remove(0)
      assert.strictEqual(dll.first(), null)
      assert.strictEqual(dll.last(), null)
      assert.strictEqual(dll.length(), 0)
    })

    it('should work when items are removed via iterator asynchronously', async () => {
      dll = new DoublyLinkedList<string>()
      dll.push('foo')
      dll.push('bar')

      await new Promise<void>((resolve: () => void) => {
        const latch = after(2, resolve)

        dll.iterate((item: string, remove: () => void) => {
          if (item === 'foo') {
            setImmediate(() => {
              remove()
              latch()
            })
            return
          }

          latch()
        })
      })

      assert.strictEqual(dll.first(), 'bar')
      assert.strictEqual(dll.last(), 'bar')
      assert.strictEqual(dll.length(), 1)
    })

    it('should work when items are removed via map iterator asynchronously', async () => {
      dll = new DoublyLinkedList<string>()
      dll.push('foo')
      dll.push('bar')

      await Promise.all(dll.map<Promise<void>>((item: string, remove: () => void) => new Promise<void>((resolve: () => void) => {
        if (item === 'foo') {
          setImmediate(() => {
            remove()
            resolve()
          })
          return
        }
        resolve()
      })))

      assert.strictEqual(dll.first(), 'bar')
      assert.strictEqual(dll.last(), 'bar')
      assert.strictEqual(dll.length(), 1)
    })
  })
})

function after(n: number, cb: () => void): () => void {
  let count = 0

  return () => {
    count++

    if (count < n) {
      return
    }

    cb()
  }
}
