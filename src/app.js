const express = require('express')
const { authenticate } = require('./auth')
const tasksRouter = require('./routes/tasks')
const projectsRouter = require('./routes/projects')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '10kb' }))

// Health check cho Docker/load balancer: không cần token, không trả dữ liệu nghiệp vụ.
app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use(authenticate)

app.use('/tasks', tasksRouter)
app.use('/projects', projectsRouter)

app.use((req, res) => res.status(404).json({ error: 'not_found' }))

/** @type {Record<string, string>} lỗi của body parser → mã lỗi ổn định cho client */
const PARSER_ERRORS = { 'entity.parse.failed': 'invalid_json', 'entity.too.large': 'payload_too_large' }

/** @type {import('express').ErrorRequestHandler} */
const errorHandler = (err, req, res, next) => {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.code || PARSER_ERRORS[err.type] || 'bad_request' })
  }
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
}
app.use(errorHandler)

module.exports = app
