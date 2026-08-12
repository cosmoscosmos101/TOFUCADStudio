import { useCADHistory } from '../hooks/useCADHistory'
import { motion, AnimatePresence } from 'framer-motion'

function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function HistoryEntry({ record, index, isCurrent, isFuture, onClick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        marginBottom: '2px',
        background: isCurrent
          ? 'linear-gradient(90deg, rgba(0,229,255,0.12), rgba(0,229,255,0.04))'
          : 'transparent',
        border: isCurrent
          ? '1px solid rgba(0,229,255,0.35)'
          : '1px solid transparent',
        borderRadius: '3px',
        cursor: 'pointer',
        opacity: isFuture ? 0.35 : 1,
        transition: 'all 150ms',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isCurrent) e.currentTarget.style.background = 'rgba(0,229,255,0.05)'
      }}
      onMouseLeave={e => {
        if (!isCurrent) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Active indicator bar */}
      {isCurrent && (
        <div style={{
          position: 'absolute',
          left: 0, top: 4, bottom: 4,
          width: 2,
          background: 'var(--cyan)',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 6px var(--cyan)',
        }} />
      )}

      {/* Icon */}
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{record.icon}</span>

      {/* Name + timestamp */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: '0.8rem',
          color: isCurrent ? 'var(--cyan)' : 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '0.03em',
        }}>
          {record.name}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.62rem',
          color: 'var(--text-dim)',
          letterSpacing: '0.04em',
        }}>
          {formatTime(record.timestamp)}
        </div>
      </div>

      {/* Strategy badge */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.55rem',
        letterSpacing: '0.06em',
        color: record._undo ? 'rgba(0,229,255,0.5)' : 'rgba(224,64,251,0.6)',
        border: `1px solid ${record._undo ? 'rgba(0,229,255,0.2)' : 'rgba(224,64,251,0.2)'}`,
        padding: '1px 5px',
        borderRadius: '2px',
        flexShrink: 0,
        title: record._undo ? 'Option A: command inverse' : 'Option B: snapshot restore',
      }}>
        {record._undo ? 'A' : 'B'}
      </span>

      {/* Step number */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--text-dim)',
        flexShrink: 0,
        minWidth: '18px',
        textAlign: 'right',
      }}>
        {index + 1}
      </span>
    </motion.div>
  )
}

export default function HistoryPanel() {
  const { past, future, undo, redo, jumpTo, clear } = useCADHistory()

  const canUndo = past.length > 0
  const canRedo  = future.length > 0

  // All entries in chronological order:
  // past entries (0…past.length-1) + future entries shown dimmed
  const allEntries = [
    ...past.map((r, i) => ({ record: r, index: i, isCurrent: i === past.length - 1, isFuture: false })),
    ...future.map((r, i) => ({ record: r, index: past.length + i, isCurrent: false, isFuture: true })),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '8px',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'center',
      }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            flex: 1,
            padding: '6px',
            background: canUndo ? 'var(--cyan-dim)' : 'transparent',
            border: `1px solid ${canUndo ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            color: canUndo ? 'var(--cyan)' : 'var(--text-dim)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            borderRadius: '3px',
            transition: 'all 150ms',
          }}
        >
          ↩ Undo
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          style={{
            flex: 1,
            padding: '6px',
            background: canRedo ? 'var(--magenta-dim)' : 'transparent',
            border: `1px solid ${canRedo ? 'var(--border-magenta)' : 'var(--border-subtle)'}`,
            color: canRedo ? 'var(--magenta)' : 'var(--text-dim)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            borderRadius: '3px',
            transition: 'all 150ms',
          }}
        >
          ↪ Redo
        </button>

        <button
          onClick={clear}
          disabled={!canUndo && !canRedo}
          title="Clear history"
          style={{
            padding: '6px 8px',
            background: 'none',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            cursor: canUndo || canRedo ? 'pointer' : 'not-allowed',
            borderRadius: '3px',
            transition: 'all 150ms',
          }}
        >
          ✕
        </button>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '6px 10px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'rgba(0,229,255,0.6)',
          letterSpacing: '0.06em',
        }}>
          [A] command inverse
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'rgba(224,64,251,0.6)',
          letterSpacing: '0.06em',
        }}>
          [B] snapshot restore
        </span>
      </div>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {allEntries.length === 0 ? (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            letterSpacing: '0.06em',
          }}>
            NO HISTORY YET
            <br />
            <span style={{ fontSize: '0.65rem', marginTop: '8px', display: 'block' }}>
              Add objects to start tracking
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {allEntries.map(({ record, index, isCurrent, isFuture }) => (
              <HistoryEntry
                key={`${record.timestamp}-${index}`}
                record={record}
                index={index}
                isCurrent={isCurrent}
                isFuture={isFuture}
                onClick={() => jumpTo(index)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer stats */}
      {allEntries.length > 0 && (
        <div style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.62rem',
            color: 'var(--text-dim)',
          }}>
            {past.length} step{past.length !== 1 ? 's' : ''}
          </span>
          {canRedo && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              color: 'rgba(224,64,251,0.5)',
            }}>
              {future.length} redo available
            </span>
          )}
        </div>
      )}
    </div>
  )
}
