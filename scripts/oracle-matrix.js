// Chạy bộ test HIỆN TẠI trên src của từng tag, lập bảng test oracle [O*] qua/trượt (giống slide 25).
// Usage: node scripts/oracle-matrix.js > docs/evidence/oracle-matrix.md
const { execFileSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const TAGS = ['starter', 'v1', 'v2', 'v3', 'v4-pre', 'v4', 'final', 'submit']
const JEST = path.join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js')

function runAgainst(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oracle-${tag}-`))
  const git = args => execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' })
  try {
    git(['worktree', 'add', '--detach', '--force', dir, tag])
    fs.cpSync(path.join(ROOT, 'test'), path.join(dir, 'test'), { recursive: true })
    fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'))
    const out = path.join(dir, 'result.json')
    spawnSync(
      process.execPath,
      [JEST, '--rootDir', dir, '--modulePaths', path.join(ROOT, 'node_modules'), '--runInBand', '--json', '--outputFile', out],
      { cwd: dir, stdio: 'ignore' },
    )
    return JSON.parse(fs.readFileSync(out, 'utf8')).testResults.flatMap(f => f.assertionResults)
  } finally {
    git(['worktree', 'remove', '--force', dir])
  }
}

const results = Object.fromEntries(TAGS.map(tag => [tag, runAgainst(tag)]))

const oracleId = title => (title.match(/^\[(O\d+)\]/) || [])[1]
const latest = results[TAGS.at(-1)]
const oracle = latest
  .filter(a => oracleId(a.title))
  .sort((a, b) => Number(oracleId(a.title).slice(1)) - Number(oracleId(b.title).slice(1)))

const statusOf = (tag, id) => {
  const hit = results[tag].find(a => oracleId(a.title) === id)
  return hit && hit.status === 'passed' ? '✅' : '❌'
}

const lines = [
  '# Bảng test oracle theo phiên bản',
  '',
  'Sinh bởi `node scripts/oracle-matrix.js`: chạy bộ test hiện tại trên `src/` của từng git tag.',
  '',
  `| Test | Tình huống | ${TAGS.join(' | ')} |`,
  `| --- | --- | ${TAGS.map(() => ':---:').join(' | ')} |`,
  ...oracle.map(a => {
    const id = oracleId(a.title)
    const label = a.title.replace(/^\[O\d+\]\s*/, '')
    return `| ${id} | ${label} | ${TAGS.map(tag => statusOf(tag, id)).join(' | ')} |`
  }),
  `| | **Oracle qua** | ${TAGS.map(tag => `**${oracle.filter(a => statusOf(tag, oracleId(a.title)) === '✅').length}/${oracle.length}**`).join(' | ')} |`,
  `| | Toàn bộ test qua | ${TAGS.map(tag => `${results[tag].filter(a => a.status === 'passed').length}/${results[tag].length}`).join(' | ')} |`,
  '',
  'Ghi chú:',
  '',
  '- O15 trượt từ `starter` đến `v3` vì user Dana và tenant chỉ được thêm ở `v4-pre` (token của Dana bị 401).',
  '- `v4-pre` là trạng thái cố ý chưa đúng: Admin được coi là toàn cục, nên Dana đọc được B1 (O16, O17 trượt).',
  '- Dòng "Toàn bộ test qua" ở `v4` chưa đủ vì `GET /tasks` và test nhất quán chỉ có từ `final`.',
  '- Ở `starter`, file unit test PDP không nạp được (chưa có `policy.js`) nên tổng số test đếm được ít hơn.',
  '- Các tag trước `submit` chưa có audit log, OpenAPI, `/health`, server demo, nên các test `[P*]`, `[L*]`, `[D*]`, `[S*]` trượt hoặc không nạp được ở đó. Thước đo so sánh giữa các phiên bản là 17 dòng oracle.',
  '- O8, O9, O11 qua ngay ở `starter`: đó là các request hợp lệ. Bản sửa phải giữ chúng xanh (không "từ chối hết").',
]
console.log(lines.join('\n'))
