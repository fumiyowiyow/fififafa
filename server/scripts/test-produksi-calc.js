// Verifikasi ad-hoc kalkulasi nilaiBersih modul Produksi -- project ini belum punya framework
// test terpasang (nol jest/vitest/mocha di package.json manapun, per audit 7 Agustus 2026), jadi
// ini BUKAN test file yang dijalankan otomatis di CI, cuma script manual buat dijalankan ulang
// setiap kali logic hitungNilaiBersih() di src/utils/produksi.js berubah.
// Jalankan: node server/scripts/test-produksi-calc.js

import assert from 'node:assert'
import { hitungNilaiBersih } from '../src/utils/produksi.js'

const cases = [
  { nilaiKotor: 1000000, feePersen: 0.2,  expected: 800000,   label: 'contoh dari spek: fee 20%' },
  { nilaiKotor: 1000000, feePersen: 0,    expected: 1000000,  label: 'edge case: fee 0% -> nilaiBersih = nilaiKotor' },
  { nilaiKotor: 0,       feePersen: 0.2,  expected: 0,        label: 'edge case: nilaiKotor 0' },
  { nilaiKotor: 500000,  feePersen: 0.15, expected: 425000,   label: 'fee custom 15%' },
  { nilaiKotor: 1000000, feePersen: 1,    expected: 0,        label: 'edge case ekstrem: fee 100%' },
  { nilaiKotor: 333333,  feePersen: 0.25, expected: 249999.75, label: 'presisi desimal' },
]

let passed = 0
for (const c of cases) {
  const actual = hitungNilaiBersih(c.nilaiKotor, c.feePersen)
  assert.ok(Math.abs(actual - c.expected) < 1e-9, `${c.label}: expected ${c.expected}, got ${actual}`)
  console.log(`✅ ${c.label} (nilaiKotor=${c.nilaiKotor}, fee=${c.feePersen} -> ${actual})`)
  passed++
}

console.log(`\n${passed}/${cases.length} test kalkulasi nilaiBersih PASSED`)
