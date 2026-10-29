// Dữ liệu in-memory cho lab. resetDb() đưa dữ liệu về seed để mỗi test chạy độc lập.
/** @typedef {import('./types').Seed} Seed */
/** @typedef {import('./types').Task} Task */
/** @typedef {import('./types').Membership} Membership */

/** @type {Seed} Dataset nằm ở data/seed.json để nộp kèm và chỉnh sửa không cần đụng code. */
const SEED = require('../data/seed.json')

/** @type {Seed} */
let state

function resetDb() {
  state = structuredClone(SEED)
}

// Bản sao toàn bộ dữ liệu, chỉ dùng cho trang demo (/dev/state).
const snapshot = () => structuredClone(state)

/** @param {string} id */
const findUser = id => state.users.find(u => u.id === id)
/** @param {string} id */
const findProject = id => state.projects.find(p => p.id === id)
/** @param {string} id */
const findTask = id => state.tasks.find(t => t.id === id)
/** @param {string} userId @param {string} projectId */
const findMembership = (userId, projectId) =>
  state.members.find(m => m.userId === userId && m.projectId === projectId)
/** @param {string} projectId */
const listMembers = projectId => state.members.filter(m => m.projectId === projectId)
const listProjects = () => state.projects
/** @param {string} projectId */
const listTasksByProject = projectId => state.tasks.filter(t => t.projectId === projectId)
// Tương đương SELECT * FROM tasks WHERE project_id IN (:ids): một truy vấn cho cả danh sách.
/** @param {string[]} projectIds */
const listTasksInProjects = projectIds => state.tasks.filter(t => projectIds.includes(t.projectId))

/**
 * @param {string} id
 * @param {Partial<Task>} patch
 */
function updateTask(id, patch) {
  const task = /** @type {Task} */ (findTask(id))
  Object.assign(task, patch)
  return task
}

/** @param {string} id */
function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id)
  state.tasks = state.tasks.filter(t => t.projectId !== id)
  state.members = state.members.filter(m => m.projectId !== id)
}

/** @param {Membership} member */
function addMember(member) {
  state.members.push(member)
  return member
}

/** @param {string} projectId @param {string} userId */
function removeMember(projectId, userId) {
  state.members = state.members.filter(m => !(m.projectId === projectId && m.userId === userId))
}

resetDb()

module.exports = {
  resetDb,
  snapshot,
  findUser,
  findProject,
  findTask,
  findMembership,
  listMembers,
  listProjects,
  listTasksByProject,
  listTasksInProjects,
  updateTask,
  deleteProject,
  addMember,
  removeMember,
}
