// PEP cho task: mọi entry point (route, job, export) đọc task qua service này.
const db = require('../db')
const { loadTask, loadProject, enforce } = require('./access')

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

module.exports = { getTask, listProjectTasks }
