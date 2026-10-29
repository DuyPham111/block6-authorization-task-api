const router = require('express').Router()
const { requireScope } = require('../auth')
const taskService = require('../services/taskService')

// Route chỉ chuyển request vào service; kiểm quyền nằm trong service (business layer).
router.get('/:id', requireScope('tasks:read'), (req, res) => {
  res.json(taskService.getTask(req.user, req.params.id))
})

router.patch('/:id', requireScope('tasks:write'), (req, res) => {
  res.json(taskService.updateTask(req.user, req.params.id, req.body))
})

module.exports = router
