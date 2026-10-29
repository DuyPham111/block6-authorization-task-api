const router = require('express').Router()
const { requireScope } = require('../auth')
const taskService = require('../services/taskService')
const projectService = require('../services/projectService')

// Route chỉ chuyển request vào service; kiểm quyền nằm trong service (business layer).
router.get('/:id/tasks', requireScope('tasks:read'), (req, res) => {
  res.json(taskService.listProjectTasks(req.user, req.params.id))
})

router.delete('/:id', requireScope('projects:manage'), (req, res) => {
  projectService.deleteProject(req.user, req.params.id)
  res.sendStatus(204)
})

router.post('/:id/members', requireScope('projects:manage'), (req, res) => {
  res.status(201).json(projectService.addMember(req.user, req.params.id, req.body))
})

router.delete('/:id/members/:userId', requireScope('projects:manage'), (req, res) => {
  projectService.removeMember(req.user, req.params.id, req.params.userId)
  res.sendStatus(204)
})

module.exports = router
