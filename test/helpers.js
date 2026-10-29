const request = require('supertest')
const app = require('../src/app')
const { signToken } = require('../src/auth')

const api = () => request(app)
const bearer = (userId, options) => `Bearer ${signToken(userId, options)}`

// Response từ chối phải đúng mã và không chứa dữ liệu của resource.
function expectDenied(res, status) {
  expect(res.status).toBe(status)
  expect(Array.isArray(res.body)).toBe(false)
  expect(res.body).not.toHaveProperty('title')
  expect(res.body).not.toHaveProperty('description')
}

module.exports = { api, bearer, expectDenied }
