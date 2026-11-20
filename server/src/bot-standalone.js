import 'dotenv/config'
import bot, { mulaiJadwal } from './bot.js'

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN tidak ada, bot tidak dijalankan')
  process.exit(1)
}

mulaiJadwal()
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🤖 Telegram Bot standalone aktif'))
  .catch(err => { console.error('Bot error:', err.message); process.exit(1) })

process.once('SIGINT',  () => { bot.stop('SIGINT');  process.exit(0) })
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0) })
