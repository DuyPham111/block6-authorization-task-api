// Dữ liệu in-memory cho lab. resetDb() đưa dữ liệu về seed để mỗi test chạy độc lập.
const SEED = {
  tenants: [
    { id: 'alpha', name: 'Tenant Alpha' },
    { id: 'beta', name: 'Tenant Beta' },
  ],
  users: [
    { id: 'alice', name: 'Alice', tenantId: 'alpha' },
    { id: 'bob', name: 'Bob', tenantId: 'alpha' },
    { id: 'vera', name: 'Vera', tenantId: 'alpha' },
    { id: 'erin', name: 'Erin', tenantId: 'alpha' },
    { id: 'dana', name: 'Dana', tenantId: 'alpha', tenantRole: 'Admin' },
    { id: 'charlie', name: 'Charlie', tenantId: 'beta' },
  ],
  projects: [
    { id: 'alpha', name: 'Project Alpha', tenantId: 'alpha' },
    { id: 'beta', name: 'Project Beta', tenantId: 'beta' },
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

// Bản sao toàn bộ dữ liệu, chỉ dùng cho trang demo (/dev/state).
const snapshot = () => structuredClone(state)

const findUser = id => state.users.find(u => u.id === id)
const findProject = id => state.projects.find(p => p.id === id)
const findTask = id => state.tasks.find(t => t.id === id)
const findMembership = (userId, projectId) =>
  state.members.find(m => m.userId === userId && m.projectId === projectId)
const listMembers = projectId => state.members.filter(m => m.projectId === projectId)
const listProjects = () => state.projects
const listTasksByProject = projectId => state.tasks.filter(t => t.projectId === projectId)
// Tương đương SELECT * FROM tasks WHERE project_id IN (:ids): một truy vấn cho cả danh sách.
const listTasksInProjects = projectIds => state.tasks.filter(t => projectIds.includes(t.projectId))

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
