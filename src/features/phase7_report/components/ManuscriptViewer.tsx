import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from 'recharts'
import type { Manuscript, AnnexesData } from '../types.ts'
import { PrismaDiagram } from '../../phase3_screening/components/PrismaDiagram.tsx'
import ExtractionMatrixTable from '../../phase5_extraction/components/ExtractionMatrixTable.tsx'
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

const OTHER_COUNTRY_LABEL = 'OTROS'
const OTHER_FILL = '#3A86FF'

const hashStringToHue = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360
  }
  return hash
}

const colorForCountry = (country: string) => {
  if (!country) return OTHER_FILL
  if (country === OTHER_COUNTRY_LABEL) return OTHER_FILL
  const hue = hashStringToHue(country)
  return `hsl(${hue}, 70%, 60%)`
}

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

  const reportByCountry = (() => {
    const items = (annexes?.byCountry ?? []).map((row) => ({
      name: String(row.name ?? ''),
      value: typeof row.value === 'number' ? row.value : 0,
    }))

    const total = items.reduce((sum, row) => sum + row.value, 0)
    if (!total) return { data: items, hasOtherBucket: false }

    const withPct = items.map((row) => ({ ...row, percent: row.value / total }))
    const minor = withPct.filter((row) => row.value <= 1 || row.percent < 0.01)
    const major = withPct.filter((row) => !(row.value <= 1 || row.percent < 0.01))

    const normalizedMajor = major
      .slice()
      .sort((a, b) => b.value - a.value)
      .map(({ percent, ...rest }) => rest)

    const top = normalizedMajor.slice(0, 12)
    const tail = normalizedMajor.slice(12)

    const othersValue = [...minor, ...tail].reduce((sum, row) => sum + row.value, 0)
    if (!othersValue) return { data: top, hasOtherBucket: false }

    return {
      data: [...top, { name: OTHER_COUNTRY_LABEL, value: othersValue }].sort((a, b) => b.value - a.value),
      hasOtherBucket: true,
    }
  })()

  const renderCountryBarLabel = (props: any) => {
    const { x, y, width, height, index } = props
    const entry = reportByCountry.data[index]
    if (!entry) return null

    const total = reportByCountry.data.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0)
    const value = typeof entry.value === 'number' ? entry.value : 0
    const percent = total > 0 ? value / total : 0
    const label = `${value} (${(percent * 100).toFixed(0)}%)`

    const barWidth = typeof width === 'number' ? width : 0
    const baseX = typeof x === 'number' ? x : 0
    const baseY = typeof y === 'number' ? y : 0
    const baseH = typeof height === 'number' ? height : 0
    const inside = barWidth >= 46
    const labelX = inside ? baseX + barWidth - 8 : baseX + barWidth + 8

    return (
      <text
        x={labelX}
        y={baseY + baseH / 2}
        dominantBaseline="middle"
        textAnchor={inside ? 'end' : 'start'}
        fill="#111"
        fontSize={11}
        fontFamily="Arial"
      >
        {label}
      </text>
    )
  }

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
            style={{
              fontFamily: 'Arial',
              fontSize: 11,
              textAlign: section.field === 'abstract' ? 'center' : 'justify',
            }}
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
                      style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'center' }}
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
                  <div id="phase7-table-matrix" className="bg-white select-text">
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
                      <BarChart data={reportByCountry.data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                        <XAxis type="number" stroke="#111" allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={170}
                          stroke="#111"
                          tick={{ fill: '#111', fontSize: 11, fontFamily: 'Arial' }}
                        />
                        <Bar dataKey="value" stroke="#111" strokeWidth={2} barSize={16} label={renderCountryBarLabel}>
                          {reportByCountry.data.map((entry) => (
                            <Cell key={`cell-${entry.name}`} fill={colorForCountry(String(entry.name ?? ''))} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {reportByCountry.hasOtherBucket ? (
                    <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                      <strong>
                        <em>{isEnglish ? 'Note: OTROS groups countries with 1 study or < 1% share.' : 'Nota: OTROS agrupa países con 1 estudio o participación < 1%.'}</em>
                      </strong>
                    </p>
                  ) : null}
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
          <h3 className="text-2xl font-black text-black">Referencias bibliográficas</h3>
        </header>
        <textarea
          className="w-full border-4 border-black bg-neutral-50 p-4 text-lg leading-relaxed text-black placeholder:text-neutral-500"
          style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}
          value={manuscript.references.join('\n')}
          rows={6}
          onChange={(event) => onChange('references', event.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
        />
      </article>
    </section>
  )
}
