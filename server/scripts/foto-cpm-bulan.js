// Foto CPM satu bulan secara manual: node scripts/foto-cpm-bulan.js <bulan> <tahun> [--timpa]
// Default hanya mengisi studio yang belum punya foto. --timpa menghitung ulang dari kondisi SEKARANG.
import 'dotenv/config'
import { simpanFotoCpm } from '../src/utils/cpm.js'

const [bulan, tahun] = [parseInt(process.argv[2]), parseInt(process.argv[3])]
if (!(bulan >= 1 && bulan <= 12) || !(tahun >= 2020)) { console.error('Pakai: node scripts/foto-cpm-bulan.js <bulan> <tahun> [--timpa]'); process.exit(1) }
console.log(await simpanFotoCpm(bulan, tahun, { timpa: process.argv.includes('--timpa') }))
process.exit(0)
