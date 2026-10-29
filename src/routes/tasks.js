const router = require('express').Router()
const db = require('../db')
const { requireScope } = require('../auth')
const { notFound } = require('../errors')
const taskService = require('../services/taskService')

router.get('/:id', requireScope('tasks:read'), (req, res) => {
  res.json(taskService.getTask(req.user, req.params.id))
})

// STARTER: PATCH chưa kiểm quyền, sửa ở V2/V3.
router.patch('/:id', requireScope('tasks:write'), (req, res) => {
  const task = db.findTask(req.params.id)
  if (!task) throw notFound()
  res.json(db.updateTask(task.id, req.body))
})

module.exports = router
