// Membangkitkan Lampiran API & model di openspec.md langsung dari kode, supaya dokumen tidak basi.
//   node server/scripts/lampiran-openspec.mjs                          → isi openspec.md repo ini
//   node server/scripts/lampiran-openspec.mjs --circle <path/openspec.md> → isi juga daftar /api/circle di repo Unit Operations
// Bagian yang diganti ada di antara penanda <!-- api:mulai --> … <!-- api:selesai --> dan <!-- model:mulai --> … <!-- model:selesai -->
// (untuk repo Unit Operations: <!-- api-circle:mulai --> … <!-- api-circle:selesai -->).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(SERVER, '..')
const baca = (p) => fs.readFileSync(p, 'utf8')

function daftarRute() {
  const app = baca(path.join(SERVER, 'src/app.js'))
  const impor = Object.fromEntries([...app.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w.]+)\.js'/g)].map(m => [m[1], m[2]]))
  const kelompok = []
  for (const [, base, nama] of app.matchAll(/app\.use\('(\/api\/[\w/-]+)',\s*(\w+)\)/g)) {
    const berkas = impor[nama]
    if (!berkas) continue
    const src = baca(path.join(SERVER, 'src/routes', berkas + '.js'))
    const rute = new Map()
    const tambah = (metode, p) => {
      const kunci = p.replace(/\/$/, '') || '/'
      if (!rute.has(kunci)) rute.set(kunci, new Set())
      rute.get(kunci).add(metode.toUpperCase())
    }
    for (const m of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) tambah(m[1], m[2])
    for (const m of src.matchAll(/\bbk\('(get|post|put|patch|delete)',\s*'([^']*)'/g)) tambah(m[1], m[2])
    if (!rute.size) continue
    const jumlah = [...rute.values()].reduce((a, s) => a + s.size, 0)
    const isi = [...rute].map(([p, s]) => `\`${[...s].sort().join('/')} ${p}\``).join(', ')
    kelompok.push({ base, berkas, jumlah, isi })
  }
  const langsung = [...app.matchAll(/app\.(get|post)\('(\/api\/[^']+)'/g)].map(m => `\`${m[1].toUpperCase()} ${m[2]}\``)
  return { kelompok, langsung }
}

function daftarModel() {
  const sch = baca(path.join(SERVER, 'prisma/schema.prisma'))
  const model = [...sch.matchAll(/((?:^\/\/[^\n]*\n)*)^model (\w+) \{/gm)].map(([, kom, nama]) => {
    const k = kom.split('\n').map(l => l.replace(/^\/\/\s?/, '').trim()).filter(Boolean).join(' ')
    return `- \`${nama}\`${k ? ' — ' + k.slice(0, 160) : ''}`
  })
  const enumm = [...sch.matchAll(/^enum (\w+) \{/gm)].map(m => `\`${m[1]}\``)
  return `_Dibangkitkan dari \`server/prisma/schema.prisma\`: ${model.length} model, ${enumm.length} enum. Sumber kebenaran tetap \`schema.prisma\`._\n\n${model.join('\n')}\n\nEnum: ${enumm.join(', ')}`
}

function ganti(teks, penanda, isi) {
  const re = new RegExp(`(<!-- ${penanda}:mulai -->)[\\s\\S]*?(<!-- ${penanda}:selesai -->)`)
  if (!re.test(teks)) throw new Error(`penanda ${penanda} tidak ditemukan`)
  return teks.replace(re, `$1\n${isi}\n$2`)
}

const { kelompok, langsung } = daftarRute()
const total = kelompok.reduce((a, k) => a + k.jumlah, 0)
const api = `_Dibangkitkan dari \`server/src/app.js\` + \`server/src/routes/*.js\`: ${kelompok.length} kelompok, ${total} rute` +
  (langsung.length ? ` (+ langsung di app.js: ${langsung.join(', ')})` : '') + '._\n\n' +
  kelompok.map(k => `- **\`${k.base}\`** (${k.berkas}.js, ${k.jumlah} rute): ${k.isi}`).join('\n')
const spec = path.join(ROOT, 'openspec.md')
fs.writeFileSync(spec, ganti(ganti(baca(spec), 'api', api), 'model', daftarModel()))
console.log(`openspec.md: ${kelompok.length} kelompok rute, ${total} rute`)

const i = process.argv.indexOf('--circle')
if (i > 0) {
  const target = path.resolve(process.argv[i + 1])
  const c = kelompok.find(k => k.base === '/api/circle')
  const isi = `_Dibangkitkan dari \`routes/circle.js\` repo Management Dashboard: ${c.jumlah} rute. Semua memakai \`authenticate\` + \`populateRoles\`; otorisasi akhir di controller._\n\n${c.isi}`
  fs.writeFileSync(target, ganti(baca(target), 'api-circle', isi))
  console.log(`${target}: ${c.jumlah} rute /api/circle`)
}
