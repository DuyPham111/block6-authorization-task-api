require('./load-env')
const app = require('./app')

const port = Number(process.env.PORT) || 3000
const server = app.listen(port, () => console.log(`Task API listening on http://localhost:${port}`))

// Docker gửi SIGTERM khi dừng container: đóng server gọn thay vì chờ bị kill sau 10 giây.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
