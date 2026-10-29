// Lớp xác thực "có sẵn" của bài: không phải phần cần sửa trong block 6.
const jwt = require('jsonwebtoken')
const db = require('./db')

// Production bắt buộc có secret riêng; secret mặc định chỉ dùng cho dev, test và demo trên máy local.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production')
}
const SECRET = process.env.JWT_SECRET || 'block6-dev-secret'
const ALL_SCOPES = 'tasks:read tasks:write projects:manage'

/**
 * Token chỉ mang danh tính (sub) và scope OAuth2. Role và tenant không nằm trong token.
 * @param {string} sub
 * @param {{ scope?: string, expiresIn?: string | number }} [options]
 */
function signToken(sub, { scope = ALL_SCOPES, expiresIn = '15m' } = {}) {
  return jwt.sign({ sub, scope }, SECRET, /** @type {jwt.SignOptions} */ ({ algorithm: 'HS256', expiresIn }))
}

/**
 * @param {import('express').Response} res
 * @param {string} error
 */
function unauthenticated(res, error) {
  res.set('WWW-Authenticate', 'Bearer')
  return res.status(401).json({ error })
}

/** @type {import('express').RequestHandler} */
function authenticate(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ')
  if (scheme !== 'Bearer' || !token) return unauthenticated(res, 'unauthenticated')

  let payload
  try {
    payload = /** @type {jwt.JwtPayload} */ (jwt.verify(token, SECRET, { algorithms: ['HS256'] }))
  } catch {
    return unauthenticated(res, 'invalid_token')
  }

  const user = db.findUser(String(payload.sub))
  if (!user) return unauthenticated(res, 'invalid_token')

  req.user = user
  req.scopes = String(payload.scope || '').split(' ').filter(Boolean)
  next()
}

/**
 * Lớp OAuth2 scope: token có được cấp loại thao tác này không. Không xét resource cụ thể.
 * @param {string} scope
 * @returns {import('express').RequestHandler}
 */
function requireScope(scope) {
  return (req, res, next) => {
    if (req.scopes.includes(scope)) return next()
    res.status(403).json({ error: 'insufficient_scope', scope })
  }
}

module.exports = { signToken, authenticate, requireScope, ALL_SCOPES }
