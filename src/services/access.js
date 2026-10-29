// Phần dùng chung của PEP: nạp resource từ DB rồi áp dụng quyết định của PDP.
const db = require('../db')
const { decide } = require('../policy')
const { notFound, forbidden } = require('../errors')

// project luôn suy ra từ task đang lưu, không lấy projectId từ request.
function loadTask(taskId) {
  const task = db.findTask(taskId)
  if (!task) throw notFound()
  return { task, project: db.findProject(task.projectId) }
}

function loadProject(projectId) {
  const project = db.findProject(projectId)
  if (!project) throw notFound()
  return { project }
}

function enforce(user, action, resource) {
  const decision = decide(user, action, resource)
  if (!decision.allow) throw decision.visible ? forbidden() : notFound()
  return decision
}

module.exports = { loadTask, loadProject, enforce }
