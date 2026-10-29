const express = require('express')
const { authenticate } = require('./auth')
const tasksRouter = require('./routes/tasks')
const projectsRouter = require('./routes/projects')

const app = express()
app.use(express.json())
app.use(authenticate)

app.use('/tasks', tasksRouter)
app.use('/projects', projectsRouter)

app.use((req, res) => res.status(404).json({ error: 'not_found' }))

app.use((err, req, res, next) => {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.code || err.type || 'bad_request' })
  }
  console.error(err)
  res.status(500).json({ error: 'internal_error' })
})

module.exports = app
