// Phần dùng chung của PEP: nạp resource từ DB rồi áp dụng quyết định của PDP.
/** @typedef {import('../types').User} User */
/** @typedef {import('../types').Resource} Resource */
const db = require('../db')
const audit = require('../audit')
const { decide } = require('../policy')
const { notFound, forbidden } = require('../errors')

// project luôn suy ra từ task đang lưu, không lấy projectId từ request.
/** @param {string} taskId @returns {Required<Resource>} */
function loadTask(taskId) {
  const task = db.findTask(taskId)
  if (!task) throw notFound()
  const project = db.findProject(task.projectId)
  if (!project) throw notFound()
  return { task, project }
}

/** @param {string} projectId @returns {Resource} */
function loadProject(projectId) {
  const project = db.findProject(projectId)
  if (!project) throw notFound()
  return { project }
}

/**
 * @param {User} user
 * @param {string} action
 * @param {Resource} resource
 */
function enforce(user, action, resource) {
  const decision = decide(user, action, resource)
  audit.record({ user, action, resource, decision })
  if (!decision.allow) throw decision.visible ? forbidden() : notFound()
  return decision
}

module.exports = { loadTask, loadProject, enforce }
