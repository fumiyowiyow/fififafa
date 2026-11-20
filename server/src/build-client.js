// Script untuk serve client build dari Express (production)
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function serveClient(app) {
  const clientDist = path.join(__dirname, '../../client/dist')
  const indexHtml  = path.join(clientDist, 'index.html')

  app.use(express.static(clientDist))

  app.get(/(.*)/, (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(indexHtml, err => {
      if (err && !res.headersSent) {
        res.status(404).send('Client build not found. Run: npm run build')
      }
    })
  })
}
