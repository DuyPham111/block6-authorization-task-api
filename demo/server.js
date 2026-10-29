// Server DEMO cho buổi thuyết trình: app thật (src/app.js) + trang /demo + các endpoint tiện ích /dev/*.
// /dev/token cấp token cho bất kỳ user nào, nên server này chỉ nghe trên 127.0.0.1
// và KHÔNG BAO GIỜ được mount vào app production. src/app.js không import file này.
const path = require('node:path')
const express = require('express')
const app = require('../src/app')
const db = require('../src/db')
const { signToken, ALL_SCOPES } = require('../src/auth')

const demo = express()
demo.disable('x-powered-by')

demo.get('/', (req, res) => res.redirect('/demo/'))
demo.use('/demo', express.static(path.join(__dirname, 'public')))

demo.post('/dev/token', express.json(), (req, res) => {
  const { userId, scope = ALL_SCOPES, expired = false } = req.body ?? {}
  if (typeof userId !== 'string' || typeof scope !== 'string') return res.status(400).json({ error: 'invalid_request' })
  res.json({ token: signToken(userId, { scope, expiresIn: expired ? -60 : '15m' }) })
})

demo.post('/dev/reset', (req, res) => {
  db.resetDb()
  res.sendStatus(204)
})

demo.get('/dev/state', (req, res) => res.json(db.snapshot()))

// Mọi request còn lại đi vào app thật, với đầy đủ xác thực và phân quyền.
demo.use(app)

if (require.main === module) {
  const port = process.env.PORT || 3100
  demo.listen(port, '127.0.0.1', () => console.log(`Demo: http://localhost:${port}/demo/`))
}

module.exports = demo
