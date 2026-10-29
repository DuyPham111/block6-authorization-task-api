const router = require('express').Router()
const db = require('../db')
const { requireScope } = require('../auth')
const { notFound } = require('../errors')
const taskService = require('../services/taskService')

router.get('/:id/tasks', requireScope('tasks:read'), (req, res) => {
  res.json(taskService.listProjectTasks(req.user, req.params.id))
})

// STARTER: mọi người đã đăng nhập đều gọi được các chức năng quản lý project (lỗi BFLA có chủ đích), sửa ở V2.
router.delete('/:id', requireScope('projects:manage'), (req, res) => {
  if (!db.findProject(req.params.id)) throw notFound()
  db.deleteProject(req.params.id)
  res.sendStatus(204)
})

router.post('/:id/members', requireScope('projects:manage'), (req, res) => {
  if (!db.findProject(req.params.id)) throw notFound()
  const member = db.addMember({ projectId: req.params.id, userId: req.body.userId, role: req.body.role })
  res.status(201).json(member)
})

router.delete('/:id/members/:userId', requireScope('projects:manage'), (req, res) => {
  if (!db.findProject(req.params.id)) throw notFound()
  db.removeMember(req.params.id, req.params.userId)
  res.sendStatus(204)
})

module.exports = router
