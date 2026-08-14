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

// GET /api/projects/:id — single project with branches
router.get('/:id', requireAuth, async (req, res) => {
  const { data: project, error: pErr } = await supabaseAdmin
    .from('projects')
    .select('id,title,description,thumbnailUrl,isPublic,cadType,tags,ownerId,createdAt,updatedAt')
    .eq('id', req.params.id)
    .single()
  if (pErr || !project) return res.status(404).json({ error: 'Not found' })

  // Allow owner or any authenticated user to read (isPublic projects are viewable by all)
  if (project.ownerId !== req.user.sub && !project.isPublic) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: branches } = await supabaseAdmin
    .from('branches')
    .select('id,name,color,isDefault,baseBranchId,createdAt,updatedAt')
    .eq('projectId', req.params.id)
    .order('createdAt', { ascending: true })

  return res.json({ ...project, branches: branches ?? [] })
})

// GET /api/projects/:id/branches/:branchId/commits
router.get('/:id/branches/:branchId/commits', requireAuth, async (req, res) => {
  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('id,projectId')
    .eq('id', req.params.branchId)
    .eq('projectId', req.params.id)
    .single()
  if (!branch) return res.status(404).json({ error: 'Branch not found' })

  const { data, error } = await supabaseAdmin
    .from('commits')
    .select('id,message,authorId,sceneSnapshot,parentId,createdAt')
    .eq('branchId', req.params.branchId)
    .order('createdAt', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  return res.json(data ?? [])
})

// POST /api/projects/:id/branches/:branchId/commits — save a commit
router.post('/:id/branches/:branchId/commits', requireAuth, async (req, res) => {
  const { message, sceneSnapshot, parentId } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })
  if (!sceneSnapshot) return res.status(400).json({ error: 'sceneSnapshot required' })

  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('id,projectId')
    .eq('id', req.params.branchId)
    .eq('projectId', req.params.id)
    .single()
  if (!branch) return res.status(404).json({ error: 'Branch not found' })

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('commits')
    .insert({
      id: crypto.randomUUID(),
      branchId: req.params.branchId,
      message,
      authorId: req.user.sub,
      sceneSnapshot,
      parentId: parentId || null,
    })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  // Update project's sceneSnapshot and updatedAt for quick preview
  await supabaseAdmin
    .from('projects')
    .update({ sceneSnapshot, updatedAt: now })
    .eq('id', req.params.id)

  return res.status(201).json(data)
})

// POST /api/projects/:id/branches — create a branch
router.post('/:id/branches', requireAuth, async (req, res) => {
  const { name, baseBranchId, color } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })

  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id,ownerId')
    .eq('id', req.params.id)
    .single()
  if (!project || project.ownerId !== req.user.sub) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('branches')
    .insert({
      id: crypto.randomUUID(),
      projectId: req.params.id,
      name,
      color: color ?? '#c4b0ff',
      isDefault: false,
      baseBranchId: baseBranchId || null,
      updatedAt: now,
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Branch name already exists' })
    return res.status(500).json({ error: error.message })
  }
  return res.status(201).json(data)
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
