// In token để demo bằng curl: node scripts/token.js <userId> [scope ...]
const { signToken } = require('../src/auth')

const [sub, ...scopes] = process.argv.slice(2)
if (!sub) {
  console.error('Usage: node scripts/token.js <userId> [scope ...]')
  process.exit(1)
}
console.log(signToken(sub, scopes.length ? { scope: scopes.join(' ') } : undefined))
