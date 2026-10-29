// In token để demo bằng curl: npm run -s token -- <userId> [scope ...]
require('../src/load-env') // cùng JWT_SECRET với server đang chạy
const { signToken } = require('../src/auth')

const [sub, ...scopes] = process.argv.slice(2)
if (!sub) {
  console.error('Usage: node scripts/token.js <userId> [scope ...]')
  process.exit(1)
}
console.log(signToken(sub, scopes.length ? { scope: scopes.join(' ') } : undefined))
