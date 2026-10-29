const router = require('express').Router()
const db = require('../db')
const { requireScope } = require('../auth')
const { notFound } = require('../errors')

// STARTER: chỉ kiểm token và scope, KHÔNG kiểm quyền trên task (lỗi IDOR/BOLA có chủ đích).
router.get('/:id', requireScope('tasks:read'), (req, res) => {
  const task = db.findTask(req.params.id)
  if (!task) throw notFound()
  res.json(task)
})

router.patch('/:id', requireScope('tasks:write'), (req, res) => {
  const task = db.findTask(req.params.id)
  if (!task) throw notFound()
  res.json(db.updateTask(task.id, req.body))
})

module.exports = router
