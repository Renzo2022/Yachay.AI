import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import type { Manuscript, AnnexesData } from '../types.ts'
import { PrismaDiagram } from '../../phase3_screening/components/PrismaDiagram.tsx'
import { ExtractionMatrixTable } from '../../phase5_extraction/components/ExtractionMatrixTable.tsx'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../../phase5_extraction/types.ts'

interface ManuscriptViewerProps {
  manuscript: Manuscript
  onChange: (field: keyof Manuscript, value: Manuscript[keyof Manuscript]) => Promise<void>
  annexes?: AnnexesData | null
  keywords?: string[]
  matrixRows?: Array<{ study: Candidate; extraction?: ExtractionData }>
}

const PIE_COLORS = ['#EF4444', '#F97316', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']

const sections: { field: keyof Manuscript; label: string }[] = [
  { field: 'abstract', label: 'Resumen' },
  { field: 'introduction', label: 'Introducción' },
  { field: 'methods', label: 'Métodos' },
  { field: 'results', label: 'Resultados' },
  { field: 'discussion', label: 'Discusión' },
  { field: 'conclusions', label: 'Conclusiones' },
]

export const ManuscriptViewer = ({ manuscript, onChange, annexes, keywords, matrixRows }: ManuscriptViewerProps) => {
  const keywordsLine = (keywords ?? []).filter(Boolean).join(', ')

  return (
    <section className="border-4 border-black bg-white shadow-[16px_16px_0_0_#111] p-6 space-y-6">
      {sections.map((section) => (
        <article key={section.field} className="space-y-3">
          <header>
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Sección</p>
            <h3 className="text-2xl font-black text-black">{section.label}</h3>
          </header>
          <textarea
            className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed text-black placeholder:text-neutral-500"
            style={{ fontFamily: '"Merriweather", "Times New Roman", serif' }}
            value={(manuscript[section.field] as string) ?? ''}
            rows={8}
            onChange={(event) => onChange(section.field, event.target.value)}
          />

          {section.field === 'abstract' ? (
            <p className="font-mono text-xs text-neutral-700">
              <strong>Palabras clave:</strong> {keywordsLine || '—'}
            </p>
          ) : null}

          {section.field === 'results' ? (
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: '"Merriweather", serif' }}>
                    <strong>Figura 1:</strong> Diagrama PRISMA 2020
                  </p>
                  <div id="phase7-fig-prisma" className="bg-white">
                    {annexes ? (
                      <PrismaDiagram data={annexes.prisma} />
                    ) : (
                      <div className="border border-neutral-200 p-4 font-mono text-xs text-neutral-600">(Sin datos)</div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: '"Merriweather", serif' }}>
                    Fuente: Elaboración propia
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: '"Merriweather", serif' }}>
                    <strong>Tabla 1:</strong> Matriz comparativa
                  </p>
                  <div id="phase7-table-matrix" className="bg-white">
                    <ExtractionMatrixTable rows={matrixRows ?? []} variant="plain" />
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: '"Merriweather", serif' }}>
                    Fuente: Elaboración propia
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: '"Merriweather", serif' }}>
                    <strong>Figura 2:</strong> Distribución por año
                  </p>
                  <div id="phase7-fig-by-year" className="bg-white h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={annexes?.byYear ?? []} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                        <XAxis dataKey="name" stroke="#111" />
                        <YAxis stroke="#111" allowDecimals={false} />
                        <Bar dataKey="count" fill="#EF4444" stroke="#111" strokeWidth={2} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: '"Merriweather", serif' }}>
                    Fuente: Elaboración propia
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: '"Merriweather", serif' }}>
                    <strong>Figura 3:</strong> Distribución por país
                  </p>
                  <div id="phase7-fig-by-country" className="bg-white h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={annexes?.byCountry ?? []}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={40}
                          outerRadius={90}
                          stroke="#111"
                          strokeWidth={2}
                        >
                          {(annexes?.byCountry ?? []).map((entry, index) => (
                            <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: '"Merriweather", serif' }}>
                    Fuente: Elaboración propia
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </article>
      ))}

      <article className="space-y-3">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Referencias</p>
          <h3 className="text-2xl font-black text-black">Bibliografía</h3>
        </header>
        <textarea
          className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed text-black placeholder:text-neutral-500"
          style={{ fontFamily: '"Merriweather", serif' }}
          value={manuscript.references.join('\n')}
          rows={6}
          onChange={(event) => onChange('references', event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </article>
    </section>
  )
}
