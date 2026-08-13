const router         = require('express').Router()
const crypto         = require('crypto')
const { requireAuth }   = require('../middleware/auth')
const { supabaseAdmin } = require('../lib/supabase')

// GET /api/projects — my projects
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id,title,description,thumbnailUrl,isPublic,isTemplate,cadType,tags,fileSize,viewCount,forkCount,likeCount,commentCount,createdAt,updatedAt')
    .eq('ownerId', req.user.sub)
    .order('updatedAt', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// GET /api/projects/explore — public feed
router.get('/explore', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id,title,description,thumbnailUrl,cadType,tags,viewCount,forkCount,likeCount,commentCount,createdAt')
    .eq('isPublic', true)
    .order('likeCount', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

// POST /api/projects — create
router.post('/', requireAuth, async (req, res) => {
  const { title, description, cadType, tags, isPublic } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })
  const now = new Date().toISOString()
  const projectId = crypto.randomUUID()

  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .insert({
      id: projectId,
      title,
      description: description || null,
      cadType: cadType || 'MIXED',
      tags: tags || [],
      isPublic: isPublic ?? false,
      ownerId: req.user.sub,
      updatedAt: now,
    })
    .select()
    .single()
  if (pErr) return res.status(500).json({ error: pErr.message })

  // Auto-create default main branch
  await supabaseAdmin.from('branches').insert({
    id: crypto.randomUUID(),
    projectId,
    name: 'main',
    isDefault: true,
    updatedAt: now,
  })

  return res.status(201).json(project)
})

// PATCH /api/projects/:id — update
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['title', 'description', 'cadType', 'tags', 'isPublic']
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  )
  updates.updatedAt = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updates)
    .eq('id', req.params.id)
    .eq('ownerId', req.user.sub)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Not found' })
  return res.json(data)
})

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', req.params.id)
    .eq('ownerId', req.user.sub)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
})

module.exports = router
