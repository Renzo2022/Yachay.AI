import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import type { Candidate } from '../../projects/types.ts'
import { cn } from '../../../utils/cn.ts'

type ScreeningCardProps = {
  candidate: Candidate
  onConfirm: (decision: Candidate['decision']) => void
  processing?: boolean
}

const decisionStyles: Record<NonNullable<Candidate['decision']> | 'pending', { label: string; className: string }> = {
  include: { label: '🟢 INCLUIR (IA)', className: 'bg-accent-success text-main' },
  exclude: { label: '🔴 EXCLUIR (IA)', className: 'bg-accent-danger text-text-main' },
  uncertain: { label: '🟡 DUDOSO', className: 'bg-accent-warning text-main' },
  pending: { label: 'Pendiente', className: 'bg-neutral-900 text-text-main' },
}

export const ScreeningCard = ({ candidate, onConfirm, processing }: ScreeningCardProps) => {
  const decisionKey: NonNullable<Candidate['decision']> | 'pending' = candidate.decision ?? 'pending'
  const decision = decisionStyles[decisionKey]
  const showActions = decisionKey === 'uncertain' || !candidate.userConfirmed

  return (
    <article
      className={cn(
        'border-4 border-black bg-white p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] rounded-none space-y-4 transition-all',
        candidate.userConfirmed && candidate.decision === 'include' && 'border-accent-success',
        candidate.userConfirmed && candidate.decision === 'exclude' && 'border-accent-danger',
      )}
    >
      <header className={cn('px-3 py-2 font-mono text-xs uppercase border-3 border-black', decision.className)}>
        {processing ? 'Procesando...' : decision.label}
      </header>

      <div>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-900">
          {candidate.source} · {candidate.year}
        </p>
        <h3 className="text-2xl font-black uppercase text-main">{candidate.title}</h3>
        <p className="text-sm text-neutral-900 font-mono">{candidate.authors.join(', ')}</p>
        {candidate.abstract ? (
          <p className="mt-3 text-sm text-neutral-700 bg-neutral-100 border-3 border-black p-3 font-mono leading-snug">
            {candidate.abstract}
          </p>
        ) : null}
      </div>

      {candidate.reason ? (
        <div className="border-3 border-black bg-neutral-100 p-3 font-mono text-sm text-main">
          {candidate.reason}
        </div>
      ) : null}

      {showActions ? (
        <div className="flex flex-wrap gap-3">
          <BrutalButton
            variant="secondary"
            className="flex-1 bg-accent-success text-main border-black"
            onClick={() => onConfirm('include')}
            disabled={processing}
          >
            ✓ Confirmar
          </BrutalButton>
          <BrutalButton
            variant="danger"
            className="flex-1 bg-accent-danger text-text-main border-black"
            onClick={() => onConfirm('exclude')}
            disabled={processing}
          >
            ✕ Cambiar decisión
          </BrutalButton>
        </div>
      ) : null}

    </article>
  )
}
