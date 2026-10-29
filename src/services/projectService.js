// PEP cho các chức năng quản lý project (chặn BFLA: gọi chức năng vượt role).
/** @typedef {import('../types').User} User */
const db = require('../db')
const { ROLES } = require('../policy')
const { loadProject, enforce } = require('./access')
const { badRequest, notFound, conflict } = require('../errors')

/** @param {User} user @param {string} projectId */
function deleteProject(user, projectId) {
  const resource = loadProject(projectId)
  enforce(user, 'project:delete', resource)
  db.deleteProject(projectId)
}

/**
 * `role` ở đây là role của người được thêm, không phải role của người gọi.
 * @param {User} user
 * @param {string} projectId
 * @param {{ userId?: unknown, role?: unknown }} [body]
 */
function addMember(user, projectId, { userId, role } = {}) {
  const resource = loadProject(projectId)
  enforce(user, 'member:manage', resource)

  if (typeof role !== 'string' || !ROLES.includes(role)) throw badRequest('invalid_role')
  // Chỉ thêm được user cùng tenant với project: membership không được vượt tenant boundary.
  const target = typeof userId === 'string' ? db.findUser(userId) : undefined
  if (!target || target.tenantId !== resource.project.tenantId) throw badRequest('invalid_user')
  if (db.findMembership(target.id, projectId)) throw conflict('already_member')
  return db.addMember({ projectId, userId: target.id, role })
}

/** @param {User} user @param {string} projectId @param {string} userId */
function removeMember(user, projectId, userId) {
  const resource = loadProject(projectId)
  enforce(user, 'member:manage', resource)

  const membership = db.findMembership(userId, projectId)
  if (!membership) throw notFound()
  const owners = db.listMembers(projectId).filter(m => m.role === 'Owner')
  if (membership.role === 'Owner' && owners.length === 1) throw conflict('last_owner')
  db.removeMember(projectId, userId)
}

module.exports = { deleteProject, addMember, removeMember }
