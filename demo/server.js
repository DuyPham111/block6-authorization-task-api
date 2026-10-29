// Server DEMO cho buổi thuyết trình: app thật (src/app.js) + trang /demo + Swagger UI + các endpoint /dev/*.
// /dev/token cấp token cho bất kỳ user nào, nên server này chỉ nghe trên 127.0.0.1
// và KHÔNG BAO GIỜ được mount vào app production. src/app.js không import file này.
if (require.main === module) require('../src/load-env') // nạp .env trước khi auth.js đọc JWT_SECRET
const path = require('node:path')
const express = require('express')
const swaggerUi = require('swagger-ui-express')
const app = require('../src/app')
const db = require('../src/db')
const audit = require('../src/audit')
const { signToken, ALL_SCOPES } = require('../src/auth')

const demo = express()
demo.disable('x-powered-by')

demo.get('/', (req, res) => res.redirect('/demo/'))
demo.use('/demo', express.static(path.join(__dirname, 'public')))

// Tài liệu API: đặc tả OpenAPI là file tĩnh trong docs/, Swagger UI đọc trực tiếp file đó.
demo.get('/openapi.yaml', (req, res) => res.sendFile(path.join(__dirname, '..', 'docs', 'openapi.yaml')))
demo.use('/docs', swaggerUi.serve, swaggerUi.setup(undefined, {
  customSiteTitle: 'Task API · OpenAPI',
  swaggerOptions: { url: '/openapi.yaml', persistAuthorization: true },
}))

demo.post('/dev/token', express.json(), (req, res) => {
  const { userId, scope = ALL_SCOPES, expired = false } = req.body ?? {}
  if (typeof userId !== 'string' || typeof scope !== 'string') return res.status(400).json({ error: 'invalid_request' })
  res.json({ token: signToken(userId, { scope, expiresIn: expired ? -60 : '15m' }) })
})

demo.post('/dev/reset', (req, res) => {
  db.resetDb()
  audit.clear()
  res.sendStatus(204)
})

demo.get('/dev/state', (req, res) => res.json(db.snapshot()))

// Lý do quyết định của PDP chỉ có trong audit log phía server; trang demo đọc ở đây để giải thích khi trình bày.
demo.get('/dev/audit', (req, res) => res.json({ entries: audit.recentEntries(Number(req.query.after) || 0) }))

// Mọi request còn lại đi vào app thật, với đầy đủ xác thực và phân quyền.
demo.use(app)

if (require.main === module) {
  const port = Number(process.env.DEMO_PORT) || 3100
  demo.listen(port, '127.0.0.1', () => {
    console.log(`Demo: http://localhost:${port}/demo/`)
    console.log(`Swagger UI: http://localhost:${port}/docs`)
  })
}

module.exports = demo
