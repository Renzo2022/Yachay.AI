import { useState } from 'react'
import type { ExternalPaper } from '../types.ts'
import { cn } from '../../../utils/cn.ts'

type PaperCardProps = {
  paper: ExternalPaper
  selected: boolean
  onToggle: (paperId: string) => void
}

const ACCESS_STYLES = {
  open: {
    label: 'PDF Disponble',
    className: 'bg-accent-success text-main',
  },
  restricted: {
    label: 'Restringido',
    className: 'bg-accent-danger text-text-main',
  },
}

const SOURCE_LABELS: Record<ExternalPaper['source'], string> = {
  semantic_scholar: 'Semantic Scholar',
  pubmed: 'PubMed',
  crossref: 'CrossRef',
  europe_pmc: 'Europe PMC',
}

export const PaperCard = ({ paper, selected, onToggle }: PaperCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const access = paper.isOpenAccess ? ACCESS_STYLES.open : ACCESS_STYLES.restricted

  return (
    <article
      className={cn(
        'relative border-3 border-black bg-white p-5 rounded-none shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] space-y-4 transition-all duration-150',
        selected && 'border-accent-success shadow-[5px_5px_0px_0px_#00FF00]',
      )}
    >
      <button
        type="button"
        className={cn(
          'absolute top-4 right-4 w-6 h-6 border-3 border-black bg-white flex items-center justify-center font-black text-main',
          selected && 'bg-accent-success text-main',
        )}
        onClick={() => onToggle(paper.id)}
      >
        {selected ? '✔' : ''}
      </button>

      <div className={cn('inline-flex items-center px-3 py-1 text-xs font-mono uppercase border-3 border-black', access.className)}>
        {access.label}
      </div>

      <header>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-900">
          {SOURCE_LABELS[paper.source] ?? 'Base externa'} · {paper.year}
        </p>
        <h3 className="text-2xl font-black uppercase text-main">{paper.title}</h3>
        <p className="text-sm text-neutral-900 font-mono">{paper.authors.join(', ')}</p>
      </header>

      <div className="text-sm text-neutral-900 leading-relaxed">
        {expanded ? paper.abstract : `${paper.abstract.slice(0, 220)}${paper.abstract.length > 220 ? '...' : ''}`}
        {paper.abstract.length > 220 ? (
          <button
            type="button"
            className="text-accent-primary font-bold ml-2"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Mostrar menos' : 'Leer más'}
          </button>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-3 text-xs font-mono uppercase text-neutral-900">
        {paper.doi ? <span>DOI: {paper.doi}</span> : null}
        <a href={paper.url} target="_blank" rel="noreferrer" className="text-accent-primary underline">
          Abrir fuente
        </a>
        {typeof paper.citationCount === 'number' ? <span>Citas: {paper.citationCount}</span> : null}
      </footer>
    </article>
  )
}
