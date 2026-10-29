// PEP cho task: mọi entry point (route, job, export) đọc và sửa task qua service này.
const db = require('../db')
const { loadTask, loadProject, enforce } = require('./access')
const { badRequest } = require('../errors')

// Chỉ các field này được sửa qua PATCH; id, projectId, assignee bị bỏ qua (chống mass assignment).
const EDITABLE_FIELDS = ['title', 'description', 'status']
const STATUSES = ['Open', 'Closed']

const pick = (body, fields) =>
  Object.fromEntries(fields.filter(f => Object.hasOwn(body, f)).map(f => [f, body[f]]))

function getTask(user, taskId) {
  const resource = loadTask(taskId)
  enforce(user, 'task:read', resource)
  return resource.task
}

// Một quyết định cho cả project thay vì kiểm từng task (tránh N+1 truy vấn quyền).
function listProjectTasks(user, projectId) {
  const resource = loadProject(projectId)
  enforce(user, 'task:read', resource)
  return db.listTasksByProject(projectId)
}

function updateTask(user, taskId, body = {}) {
  const resource = loadTask(taskId)
  // Kiểm quyền trên bản ghi đang lưu, trước khi áp dụng bất kỳ thay đổi nào từ body.
  enforce(user, 'task:edit', resource)

  const patch = pick(body, EDITABLE_FIELDS)
  if ('status' in patch && !STATUSES.includes(patch.status)) throw badRequest('invalid_status')
  return db.updateTask(taskId, patch)
}

module.exports = { getTask, listProjectTasks, updateTask }
