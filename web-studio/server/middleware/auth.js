const jwt = require('jsonwebtoken')
const SECRET = process.env.JWT_SECRET || 'tofu-dev-secret-change-in-prod'

function requireAuth(req, res, next) {
  const token = req.cookies?.access_token
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { requireAuth }
