interface Option {
  label: string
  sub?: string
  onSelect: () => void
}

interface Props {
  title: string
  options: Option[]
  onClose: () => void
}

export function ActionSheet({ title, options, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: '1px solid var(--border)',
          borderBottom: 'none',
          padding: '10px 16px calc(var(--safe-bottom) + 16px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 4, margin: '6px auto 14px' }} />
        <div className="section-label" style={{ margin: '0 4px 10px' }}>
          {title}
        </div>
        {options.map((opt) => (
          <button
            key={opt.label}
            className="select-row"
            style={{ width: '100%', display: 'block' }}
            onClick={() => {
              opt.onSelect()
              onClose()
            }}
          >
            <div className="select-row-title">{opt.label}</div>
            {opt.sub && <div className="select-row-sub">{opt.sub}</div>}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: 4 }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
