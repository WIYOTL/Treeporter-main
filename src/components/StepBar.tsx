interface Props {
  current: number // 0-3
}

const LABELS = ['Dock', 'Destination', 'Aperçu', 'Envoi']

export function StepBar({ current }: Props) {
  return (
    <div>
      <div className="steps">
        {LABELS.map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i < current ? 'is-done' : i === current ? 'is-active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
