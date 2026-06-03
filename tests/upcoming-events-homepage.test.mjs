import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const homepageHtml = readFileSync(
  resolve('/Users/neoyang/陌生連結所/marketing-site/index.html'),
  'utf8',
)

test('homepage event cards only show 時間待定 for sentinel open-call rows', () => {
  assert.match(
    homepageHtml,
    /isOpenCallSentinel\(e\.starts_at\)/,
  )
  assert.doesNotMatch(
    homepageHtml,
    /const dateMeta = isOpenCall\s*\n\s*\? '時間待定'/,
  )
})
