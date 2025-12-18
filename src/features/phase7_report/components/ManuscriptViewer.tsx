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
  keywordsEn?: string[]
  matrixRows?: Array<{ study: Candidate; extraction?: ExtractionData }>
}

const PIE_COLORS = ['#EF4444', '#F97316', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']

const sectionsEs: { field: keyof Manuscript; label: string }[] = [
  { field: 'abstract', label: 'Resumen' },
  { field: 'introduction', label: 'Introducción' },
  { field: 'methods', label: 'Métodos' },
  { field: 'results', label: 'Resultados' },
  { field: 'discussion', label: 'Discusión' },
  { field: 'conclusions', label: 'Conclusiones' },
]

const sectionsEn: { field: keyof Manuscript; label: string }[] = [
  { field: 'abstract', label: 'Abstract' },
  { field: 'introduction', label: 'Introduction' },
  { field: 'methods', label: 'Methods' },
  { field: 'results', label: 'Results' },
  { field: 'discussion', label: 'Discussion' },
  { field: 'conclusions', label: 'Conclusions' },
]

const renderPieLabel = (props: {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
  name?: string
}) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props
  if (!cx || !cy || !Number.isFinite(midAngle) || innerRadius == null || outerRadius == null) return null
  if (!name) return null

  const pct = typeof percent === 'number' ? percent : 0
  if (pct < 0.05) return null

  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  const label = `${name} ${(pct * 100).toFixed(0)}%`

  return (
    <text x={x} y={y} fill="#111" textAnchor="middle" dominantBaseline="central" fontSize={10} fontFamily="Arial">
      {label}
    </text>
  )
}

export const ManuscriptViewer = ({ manuscript, onChange, annexes, keywords, keywordsEn, matrixRows }: ManuscriptViewerProps) => {
  const isEnglish = manuscript.language === 'en'
  const sections = isEnglish ? sectionsEn : sectionsEs
  const keywordsLine = (keywords ?? []).filter(Boolean).join(', ')
  const keywordsLineEn = (keywordsEn ?? []).filter(Boolean).join(', ')

  const keywordsForEnglish = keywordsLineEn || keywordsLine

  const figure1Label = isEnglish ? 'Figure 1:' : 'Figura 1:'
  const figure1Title = isEnglish ? 'PRISMA 2020 flow diagram' : 'Diagrama PRISMA 2020'
  const table1Label = isEnglish ? 'Table 1:' : 'Tabla 1:'
  const table1Title = isEnglish ? 'Comparative matrix (summary)' : 'Matriz comparativa (resumen)'
  const figure2Label = isEnglish ? 'Figure 2:' : 'Figura 2:'
  const figure2Title = isEnglish ? 'Distribution by year' : 'Distribución por año'
  const figure3Label = isEnglish ? 'Figure 3:' : 'Figura 3:'
  const figure3Title = isEnglish ? 'Distribution by country' : 'Distribución por país'
  const sourceText = isEnglish ? "Source: Authors' elaboration" : 'Fuente: Elaboración propia'

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
            style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}
            value={(manuscript[section.field] as string) ?? ''}
            rows={8}
            onChange={(event) => onChange(section.field, event.target.value)}
          />

          {section.field === 'abstract' ? (
            <div className="space-y-2">
              <p className="font-mono text-xs text-neutral-700">
                <strong>{isEnglish ? 'Keywords:' : 'Palabras clave:'}</strong> {isEnglish ? keywordsForEnglish || '—' : keywordsLine || '—'}
              </p>
              {!isEnglish ? (
                <>
                  <div className="border-3 border-black bg-white p-3">
                    <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-600">Abstract (EN)</p>
                    <textarea
                      className="w-full border-3 border-black bg-neutral-50 p-3 text-black placeholder:text-neutral-500"
                      style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}
                      value={manuscript.abstractEn ?? ''}
                      rows={6}
                      onChange={(event) => onChange('abstractEn', event.target.value)}
                    />
                    <p className="mt-2 font-mono text-xs text-neutral-700">
                      <strong>Keywords:</strong> {keywordsForEnglish || '—'}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {section.field === 'results' ? (
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>
                        {figure1Label} {figure1Title}
                      </em>
                    </strong>
                  </p>
                  <div id="phase7-fig-prisma" className="bg-white">
                    {annexes ? (
                      <PrismaDiagram data={annexes.prisma} />
                    ) : (
                      <div className="border border-neutral-200 p-4 font-mono text-xs text-neutral-600">(Sin datos)</div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>{sourceText}</em>
                    </strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>
                        {table1Label} {table1Title}
                      </em>
                    </strong>
                  </p>
                  <div id="phase7-table-matrix" className="bg-white">
                    <ExtractionMatrixTable rows={matrixRows ?? []} variant="compact" />
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>{sourceText}</em>
                    </strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>
                        {figure2Label} {figure2Title}
                      </em>
                    </strong>
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
                  <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>{sourceText}</em>
                    </strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>
                        {figure3Label} {figure3Title}
                      </em>
                    </strong>
                  </p>
                  <div id="phase7-fig-by-country" className="bg-white h-64 min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <PieChart>
                        <Pie
                          data={annexes?.byCountry ?? []}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={0}
                          outerRadius={90}
                          stroke="#111"
                          strokeWidth={2}
                          labelLine={false}
                          label={renderPieLabel}
                        >
                          {(annexes?.byCountry ?? []).map((entry, index) => (
                            <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                    <strong>
                      <em>Fuente: Elaboración propia</em>
                    </strong>
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
          style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}
          value={manuscript.references.join('\n')}
          rows={6}
          onChange={(event) => onChange('references', event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </article>
    </section>
  )
}
