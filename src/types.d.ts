// Kiểu dữ liệu dùng chung cho JSDoc, kiểm bằng `npm run typecheck` (tsc --checkJs). Không ảnh hưởng runtime.

export interface Tenant { id: string; name: string }
export interface User { id: string; name: string; tenantId: string; tenantRole?: string }
export interface Project { id: string; name: string; tenantId: string }
// role là string chứ không phải union: dữ liệu lỗi (role lạ) phải được PDP từ chối, không phải bị kiểu che mất.
export interface Membership { projectId: string; userId: string; role: string }
export interface Task { id: string; projectId: string; title: string; description: string; assignee: string | null; status: string }
export interface Seed { tenants: Tenant[]; users: User[]; projects: Project[]; members: Membership[]; tasks: Task[] }

/** Resource đã nạp từ DB mà PDP cần để quyết định. */
export interface Resource { project: Project; task?: Task }

export type Decision =
  | { allow: true; reason: string }
  | { allow: false; visible: boolean; reason: string }

export interface AuditEntry {
  seq: number
  ts: string
  event: 'authz.decision'
  userId: string
  action: string
  projectId: string
  taskId: string | null
  allow: boolean
  reason: string
}

declare global {
  namespace Express {
    interface Request {
      user: User
      scopes: string[]
    }
  }
}
