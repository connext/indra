import { assert } from 'chai'
import camelize from './camelize'

describe('camelize', () => {
  it('camelizes', () => {
    const values = [
      ['HONK_BEEP', 'honkBeep'],
      ['HONK', 'honk'],
    ]

    values.forEach((tuple: string[]) => {
      assert.strictEqual(camelize(tuple[0], '_'), tuple[1])
    })
  })
})
