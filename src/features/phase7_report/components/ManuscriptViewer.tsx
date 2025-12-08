import type { Manuscript } from '../types.ts'

interface ManuscriptViewerProps {
  manuscript: Manuscript
  onChange: (field: keyof Manuscript, value: Manuscript[keyof Manuscript]) => Promise<void>
}

const sections: { field: keyof Manuscript; label: string }[] = [
  { field: 'abstract', label: 'Abstract' },
  { field: 'introduction', label: 'Introducción' },
  { field: 'methods', label: 'Métodos' },
  { field: 'results', label: 'Resultados' },
  { field: 'discussion', label: 'Discusión' },
  { field: 'conclusions', label: 'Conclusiones' },
]

export const ManuscriptViewer = ({ manuscript, onChange }: ManuscriptViewerProps) => {
  return (
    <section className="border-4 border-black bg-white shadow-[16px_16px_0_0_#111] p-6 space-y-6">
      {sections.map((section) => (
        <article key={section.field} className="space-y-3">
          <header>
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Sección</p>
            <h3 className="text-2xl font-black text-neutral-900">{section.label}</h3>
          </header>
          <textarea
            className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed"
            style={{ fontFamily: '"Merriweather", "Times New Roman", serif' }}
            value={(manuscript[section.field] as string) ?? ''}
            rows={8}
            onChange={(event) => onChange(section.field, event.target.value)}
          />
        </article>
      ))}

      <article className="space-y-3">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Referencias</p>
          <h3 className="text-2xl font-black text-neutral-900">Bibliografía</h3>
        </header>
        <textarea
          className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed"
          style={{ fontFamily: '"Merriweather", serif' }}
          value={manuscript.references.join('\n')}
          rows={6}
          onChange={(event) => onChange('references', event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </article>
    </section>
  )
}
