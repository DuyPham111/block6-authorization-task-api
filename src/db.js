// Dữ liệu in-memory cho lab. resetDb() đưa dữ liệu về seed để mỗi test chạy độc lập.
const SEED = {
  users: [
    { id: 'alice', name: 'Alice' },
    { id: 'bob', name: 'Bob' },
    { id: 'vera', name: 'Vera' },
    { id: 'charlie', name: 'Charlie' },
    { id: 'erin', name: 'Erin' },
  ],
  projects: [
    { id: 'alpha', name: 'Project Alpha' },
    { id: 'beta', name: 'Project Beta' },
  ],
  members: [
    { projectId: 'alpha', userId: 'alice', role: 'Owner' },
    { projectId: 'alpha', userId: 'bob', role: 'Member' },
    { projectId: 'alpha', userId: 'vera', role: 'Viewer' },
    { projectId: 'beta', userId: 'charlie', role: 'Owner' },
  ],
  tasks: [
    { id: 'A1', projectId: 'alpha', title: 'Thiết kế màn hình đăng nhập', description: 'Wireframe và luồng lỗi', assignee: 'bob', status: 'Open' },
    { id: 'A2', projectId: 'alpha', title: 'Viết tài liệu API', description: 'OpenAPI cho /tasks', assignee: null, status: 'Open' },
    { id: 'B1', projectId: 'beta', title: 'Kế hoạch ra mắt Beta', description: 'Dữ liệu nội bộ của project Beta', assignee: 'charlie', status: 'Open' },
    { id: 'B2', projectId: 'beta', title: 'Báo cáo doanh thu quý 3', description: 'Số liệu tài chính', assignee: null, status: 'Open' },
  ],
}

let state

function resetDb() {
  state = structuredClone(SEED)
}

const findUser = id => state.users.find(u => u.id === id)
const findProject = id => state.projects.find(p => p.id === id)
const findTask = id => state.tasks.find(t => t.id === id)
const findMembership = (userId, projectId) =>
  state.members.find(m => m.userId === userId && m.projectId === projectId)
const listMembers = projectId => state.members.filter(m => m.projectId === projectId)
const listTasksByProject = projectId => state.tasks.filter(t => t.projectId === projectId)

function updateTask(id, patch) {
  const task = findTask(id)
  Object.assign(task, patch)
  return task
}

function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id)
  state.tasks = state.tasks.filter(t => t.projectId !== id)
  state.members = state.members.filter(m => m.projectId !== id)
}

function addMember(member) {
  state.members.push(member)
  return member
}

function removeMember(projectId, userId) {
  state.members = state.members.filter(m => !(m.projectId === projectId && m.userId === userId))
}

resetDb()

module.exports = {
  resetDb,
  findUser,
  findProject,
  findTask,
  findMembership,
  listMembers,
  listTasksByProject,
  updateTask,
  deleteProject,
  addMember,
  removeMember,
}
