import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitMath } from './math.ts'

const math = (t: string) => splitMath(t).filter((s) => s.kind === 'math').map((s) => s.value)

test('finds inline and display formulas in all four delimiter styles', () => {
  assert.deepEqual(math('Solve $x^2 - 4 = 0$ then $$\\frac{a}{b}$$, \\(y=mx+c\\) and \\[E=mc^2\\]'), ['x^2 - 4 = 0', '\\frac{a}{b}', 'y=mx+c', 'E=mc^2'])
  const display = splitMath('$$\\int_0^1 x\\,dx$$').find((s) => s.kind === 'math')
  assert.equal(display?.kind === 'math' && display.display, true)
})

test('leaves prices, lone dollars and ordinary text alone', () => {
  assert.deepEqual(math('It costs $5 and $10 at the shop.'), [])
  assert.deepEqual(math('Pay $ 20 now'), [])
  assert.deepEqual(math('Use 2 * 3 and 1. list items'), [])
  assert.equal(splitMath('No maths here').length, 1)
})

test('keeps the surrounding text intact and in order', () => {
  const parts = splitMath('If $a=2$, find a.')
  assert.deepEqual(parts.map((p) => p.value), ['If ', 'a=2', ', find a.'])
})
