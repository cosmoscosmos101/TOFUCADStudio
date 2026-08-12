import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGitStore } from '../hooks/useGitStore'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function CommitDot({ color, isHead }) {
  return (
    <div style={{
      width: isHead ? 12 : 8,
      height: isHead ? 12 : 8,
      borderRadius: '50%',
      background: isHead ? color : 'transparent',
      border: `2px solid ${color}`,
      boxShadow: isHead ? `0 0 8px ${color}80` : 'none',
      flexShrink: 0,
      transition: 'all 150ms',
    }} />
  )
}

export default function GitPanel() {
  const {
    branches, activeBranch, commits,
    createBranch, switchBranch, commit, checkoutCommit,
  } = useGitStore()

  const [newBranchName, setNewBranchName] = useState('')
  const [commitMsg, setCommitMsg]         = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [showCommit, setShowCommit]       = useState(false)
  const [expandBranch, setExpandBranch]   = useState(activeBranch)

  const activeBranchObj = branches.find(b => b.id === activeBranch)

  const handleCreateBranch = () => {
    const name = newBranchName.trim().replace(/\s+/g, '-').toLowerCase()
    if (!name) return
    createBranch(name)
    setNewBranchName('')
    setShowNewBranch(false)
    setExpandBranch(name)
  }

  const handleCommit = () => {
    if (!commitMsg.trim()) return
    commit(commitMsg.trim())
    setCommitMsg('')
    setShowCommit(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem' }}>⑂</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            color: activeBranchObj?.color ?? 'var(--cyan)',
            letterSpacing: '0.08em',
          }}>{activeBranch}</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => { setShowCommit(v => !v); setShowNewBranch(false) }}
            title="New commit"
            style={{ padding: '3px 8px', background: 'var(--cyan-dim)', border: '1px solid var(--border-active)', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', cursor: 'pointer', borderRadius: '2px', letterSpacing: '0.06em' }}
          >+ COMMIT</button>
          <button
            onClick={() => { setShowNewBranch(v => !v); setShowCommit(false) }}
            title="New branch"
            style={{ padding: '3px 8px', background: 'var(--magenta-dim)', border: '1px solid var(--border-magenta)', color: 'var(--magenta)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', cursor: 'pointer', borderRadius: '2px', letterSpacing: '0.06em' }}
          >⑂ BRANCH</button>
        </div>
      </div>

      {/* Quick commit form */}
      <AnimatePresence>
        {showCommit && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCommit()}
                placeholder="Commit message…"
                autoFocus
                style={{
                  background: 'var(--bg-base)', border: '1px solid var(--border-active)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
                  padding: '6px 8px', outline: 'none', borderRadius: '3px', width: '100%',
                }}
              />
              <button
                onClick={handleCommit}
                disabled={!commitMsg.trim()}
                style={{
                  padding: '6px', background: commitMsg.trim() ? 'var(--cyan-dim)' : 'transparent',
                  border: `1px solid ${commitMsg.trim() ? 'var(--border-active)' : 'var(--border-subtle)'}`,
                  color: commitMsg.trim() ? 'var(--cyan)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: commitMsg.trim() ? 'pointer' : 'not-allowed',
                  borderRadius: '3px', transition: 'all 150ms',
                }}
              >Commit to {activeBranch}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New branch form */}
      <AnimatePresence>
        {showNewBranch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div style={{ padding: '10px 12px', display: 'flex', gap: '6px' }}>
              <input
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                placeholder="feature/my-branch"
                autoFocus
                style={{
                  flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border-magenta)',
                  color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  padding: '6px 8px', outline: 'none', borderRadius: '3px',
                }}
              />
              <button
                onClick={handleCreateBranch}
                style={{
                  padding: '6px 10px', background: 'var(--magenta-dim)',
                  border: '1px solid var(--border-magenta)', color: 'var(--magenta)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.68rem', cursor: 'pointer',
                  borderRadius: '3px', flexShrink: 0,
                }}
              >Create</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branch / commit list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {branches.map(branch => {
          const branchCommits = (commits[branch.id] ?? []).slice().reverse()
          const isActive = branch.id === activeBranch
          const isExpanded = expandBranch === branch.id

          return (
            <div key={branch.id} style={{ marginBottom: '6px' }}>
              {/* Branch header */}
              <div
                onClick={() => {
                  setExpandBranch(isExpanded ? null : branch.id)
                  if (!isActive) switchBranch(branch.id)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  background: isActive ? `${branch.color}15` : 'transparent',
                  border: `1px solid ${isActive ? `${branch.color}50` : 'var(--border-subtle)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'var(--bg-elevated)')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '0.8rem', color: branch.color }}>⑂</span>
                <span style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: isActive ? branch.color : 'var(--text-secondary)',
                  letterSpacing: '0.04em',
                  fontWeight: isActive ? 700 : 400,
                }}>{branch.name}</span>
                {isActive && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.55rem',
                    color: branch.color,
                    border: `1px solid ${branch.color}50`,
                    padding: '1px 5px',
                    borderRadius: '2px',
                    letterSpacing: '0.06em',
                  }}>HEAD</span>
                )}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: 'var(--text-dim)',
                }}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>

              {/* Commits */}
              <AnimatePresence>
                {isExpanded && branchCommits.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden', paddingLeft: '20px', marginTop: '2px' }}
                  >
                    {/* Vertical branch line */}
                    <div style={{
                      borderLeft: `2px solid ${branch.color}40`,
                      paddingLeft: '10px',
                    }}>
                      {branchCommits.map((c, i) => (
                        <div
                          key={c.id}
                          onClick={() => checkoutCommit(branch.id, c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '5px 6px',
                            marginBottom: '2px',
                            marginLeft: '-14px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            transition: 'background 150ms',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <CommitDot color={branch.color} isHead={i === 0 && isActive} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: 'var(--font-ui)',
                              fontSize: '0.75rem',
                              color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                              fontWeight: i === 0 ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>{c.message}</div>
                            <div style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.58rem',
                              color: 'var(--text-dim)',
                              display: 'flex',
                              gap: '8px',
                              marginTop: '2px',
                            }}>
                              <span>{c.authorName}</span>
                              <span>{timeAgo(c.timestamp)}</span>
                              <span style={{ color: branch.color }}>{c.id.slice(0, 7)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
