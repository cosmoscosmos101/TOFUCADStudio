const router            = require('express').Router()
const bcrypt            = require('bcryptjs')
const jwt               = require('jsonwebtoken')
const crypto            = require('crypto')
const { supabaseAdmin } = require('../lib/supabase')

const SECRET      = process.env.JWT_SECRET || 'tofu-dev-secret-change-in-prod'
const COOKIE_BASE = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }
const refreshBlacklist = new Set()

function issueTokens(res, user) {
  const access  = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '15m' })
  const refresh = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' })
  res.cookie('access_token',  access,  { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', refresh, { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

function safeUser(u) {
  const { passwordHash, ...rest } = u
  return rest
}

router.post('/register', async (req, res) => {
  const { email, username, displayName, password } = req.body
  if (!email || !username || !password)
    return res.status(400).json({ error: 'email, username and password required' })
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: crypto.randomUUID(),
        email,
        username,
        displayName: displayName || username,
        passwordHash,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Email or username already taken' })
      throw error
    }
    issueTokens(res, user)
    return res.status(201).json({ user: safeUser(user) })
  } catch (e) {
    console.error('register:', e.message)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'email and password required' })
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select()
      .eq('email', email)
      .single()
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    issueTokens(res, user)
    return res.json({ user: safeUser(user) })
  } catch (e) {
    console.error('login:', e.message)
    return res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', async (req, res) => {
  const token = req.cookies?.access_token
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  try {
    const payload = jwt.verify(token, SECRET)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select()
      .eq('id', payload.sub)
      .single()
    if (error || !user) return res.status(404).json({ error: 'User not found' })
    return res.json(safeUser(user))
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
})

router.post('/refresh', (req, res) => {
  const token = req.cookies?.refresh_token
  if (!token) return res.status(401).json({ error: 'No refresh token' })
  if (refreshBlacklist.has(token)) return res.status(401).json({ error: 'Token revoked' })
  try {
    const payload = jwt.verify(token, SECRET)
    const access  = jwt.sign({ sub: payload.sub }, SECRET, { expiresIn: '15m' })
    res.cookie('access_token', access, { ...COOKIE_BASE, maxAge: 15 * 60 * 1000 })
    return res.json({ ok: true })
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
})

router.post('/logout', (req, res) => {
  const rt = req.cookies?.refresh_token
  if (rt) refreshBlacklist.add(rt)
  res.clearCookie('access_token')
  res.clearCookie('refresh_token')
  return res.json({ ok: true })
})

module.exports = router
