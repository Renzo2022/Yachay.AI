import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import type { Manuscript, AnnexesData } from '../types.ts'
import { PrismaDiagram } from '../../phase3_screening/components/PrismaDiagram.tsx'

interface ManuscriptViewerProps {
  manuscript: Manuscript
  onChange: (field: keyof Manuscript, value: Manuscript[keyof Manuscript]) => Promise<void>
  annexes?: AnnexesData | null
}

const PIE_COLORS = ['#EF4444', '#F97316', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']

const sections: { field: keyof Manuscript; label: string }[] = [
  { field: 'abstract', label: 'Abstract' },
  { field: 'introduction', label: 'Introducción' },
  { field: 'methods', label: 'Métodos' },
  { field: 'results', label: 'Resultados' },
  { field: 'discussion', label: 'Discusión' },
  { field: 'conclusions', label: 'Conclusiones' },
]

export const ManuscriptViewer = ({ manuscript, onChange, annexes }: ManuscriptViewerProps) => {
  return (
    <section className="border-4 border-black bg-white shadow-[16px_16px_0_0_#111] p-6 space-y-6">
      {sections.map((section) => (
        <article key={section.field} className="space-y-3">
          <header>
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Sección</p>
            <h3 className="text-2xl font-black text-neutral-900">{section.label}</h3>
          </header>
          <textarea
            className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed text-black placeholder:text-neutral-500"
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
          className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed text-black placeholder:text-neutral-500"
          style={{ fontFamily: '"Merriweather", serif' }}
          value={manuscript.references.join('\n')}
          rows={6}
          onChange={(event) => onChange('references', event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </article>

      <article className="space-y-4">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Sección</p>
          <h3 className="text-2xl font-black text-neutral-900">Anexos</h3>
        </header>

        {!annexes ? (
          <p className="font-mono text-sm text-neutral-600">Genera el manuscrito para ver PRISMA y gráficos en anexos.</p>
        ) : (
          <div className="space-y-6">
            <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-5">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#EF4444] mb-4">PRISMA 2020</p>
              <PrismaDiagram data={annexes.prisma} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-5 min-w-0">
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#EF4444]">Gráfico</p>
                <h4 className="text-xl font-black text-neutral-900 mt-1">Distribución por año</h4>
                <div className="h-56 mt-4 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={annexes.byYear} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke="#111" />
                      <YAxis stroke="#111" allowDecimals={false} />
                      <Bar dataKey="count" fill="#EF4444" stroke="#111" strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-5 min-w-0">
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#EF4444]">Gráfico</p>
                <h4 className="text-xl font-black text-neutral-900 mt-1">Distribución geográfica</h4>
                <div className="h-56 mt-4 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie data={annexes.byCountry} dataKey="value" nameKey="name" innerRadius={35} outerRadius={75} stroke="#111" strokeWidth={2}>
                        {annexes.byCountry.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {annexes.byCountry.slice(0, 8).map((entry, index) => {
                    const color = PIE_COLORS[index % PIE_COLORS.length]
                    return (
                      <div key={`legend-${entry.name}`} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 border-2 border-black" style={{ backgroundColor: color }} />
                          <span className="font-mono text-xs uppercase tracking-wide truncate" style={{ color }}>
                            {entry.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-neutral-700">{entry.value ?? 0}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  )
}
