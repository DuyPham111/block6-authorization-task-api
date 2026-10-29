class HttpError extends Error {
  constructor(status, code) {
    super(code)
    this.status = status
    this.code = code
  }
}

// 404 dùng chung một body cho "không tồn tại" và "không được thấy" để không lộ sự tồn tại.
const notFound = () => new HttpError(404, 'not_found')
const forbidden = () => new HttpError(403, 'forbidden')
const badRequest = code => new HttpError(400, code)
const conflict = code => new HttpError(409, code)

module.exports = { HttpError, notFound, forbidden, badRequest, conflict }
