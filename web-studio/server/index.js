require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const cookieParser = require('cookie-parser')
const authRouter     = require('./routes/auth')
const projectsRouter = require('./routes/projects')

const app  = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:5174', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth',     authRouter)
app.use('/api/projects', projectsRouter)

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }))

if (require.main === module) {
  app.listen(PORT, () => console.log(`TOFU API → http://localhost:${PORT}`))
}

module.exports = app
