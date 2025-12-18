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
  const table1Title = isEnglish ? 'Articles analyzed by population and significant contributions' : 'Artículos analizados por poblaciones y aportes'
  const table2Label = isEnglish ? 'Table 2:' : 'Tabla 2:'
  const table2Title =
    isEnglish
      ? 'Articles analyzed by title, origin, design and indexing'
      : 'Artículos analizados por títulos, lugar de procedencia, diseño e indización'
  const figure2Label = isEnglish ? 'Figure 2:' : 'Figura 2:'
  const figure2Title = isEnglish ? 'Distribution by year' : 'Distribución por año'
  const figure3Label = isEnglish ? 'Figure 3:' : 'Figura 3:'
  const figure3Title = isEnglish ? 'Distribution by country' : 'Distribución por país'
  const sourceText = isEnglish ? "Source: Authors' elaboration" : 'Fuente: Elaboración propia'

  const sourceLabel = (raw: unknown) => {
    const source = String(raw ?? '').trim()
    if (source === 'pubmed') return 'PubMed'
    if (source === 'crossref') return 'Crossref'
    if (source === 'europe_pmc') return 'Europe PMC'
    if (source === 'semantic_scholar') return 'Semantic Scholar'
    return source || '—'
  }

  const extractResultsParagraphs = (content: string) => {
    const paragraphs = String(content ?? '')
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)

    const normalized = paragraphs.map((p) => ({ raw: p, lower: p.toLowerCase() }))
    const takeByPrefix = (prefixes: string[]) =>
      normalized.find((p) => prefixes.some((prefix) => p.lower.startsWith(prefix)))?.raw ?? ''

    const fig1 = takeByPrefix(['en la figura 1', 'in figure 1'])
    const table1 = takeByPrefix(['en la tabla 1', 'in table 1'])
    const table2 = takeByPrefix(['en la tabla 2', 'in table 2'])
    const fig2 = takeByPrefix(['en la figura 2', 'in figure 2'])
    const fig3 = takeByPrefix(['en la figura 3', 'in figure 3'])

    return { fig1, table1, table2, fig2, fig3 }
  }

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
                {(() => {
                  const extracted = extractResultsParagraphs(String(manuscript.results ?? ''))
                  return (
                    <>
                      {extracted.fig1 ? (
                        <p className="text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}>
                          {extracted.fig1}
                        </p>
                      ) : null}

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

                      {extracted.table1 ? (
                        <p className="text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}>
                          {extracted.table1}
                        </p>
                      ) : null}

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

                      {extracted.table2 ? (
                        <p className="text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}>
                          {extracted.table2}
                        </p>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                          <strong>
                            <em>
                              {table2Label} {table2Title}
                            </em>
                          </strong>
                        </p>
                        <div className="bg-white select-text overflow-auto">
                          <table className="w-full border-collapse text-black select-text table-fixed" style={{ fontFamily: 'Arial', fontSize: 11 }}>
                            <thead className="bg-neutral-100 text-black">
                              <tr>
                                {['N°', isEnglish ? 'Title' : 'Título', isEnglish ? 'Country' : 'País', isEnglish ? 'Design' : 'Diseño', isEnglish ? 'Indexing' : 'Indización'].map(
                                  (header) => (
                                    <th
                                      key={header}
                                      className="border-2 border-black text-left uppercase tracking-wide break-words px-2 py-2 text-xs leading-snug"
                                    >
                                      {header}
                                    </th>
                                  ),
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {(matrixRows ?? []).map(({ study, extraction }, idx) => {
                                const country = extraction?.context?.country?.trim() ? extraction.context.country.trim() : '—'
                                const design = extraction?.methodology?.design?.trim() ? extraction.methodology.design.trim() : (study.studyType ?? '—')
                                const indexing = sourceLabel((study as any)?.source)
                                const title = String((study as any)?.title ?? '').trim() || '—'
                                return (
                                  <tr key={study.id} className="odd:bg-neutral-50">
                                    <td className="border-2 border-black px-2 py-2 align-top text-center w-12 text-xs leading-snug break-words">{idx + 1}</td>
                                    <td className="border-2 border-black px-2 py-2 align-top text-xs leading-snug break-words">{title}</td>
                                    <td className="border-2 border-black px-2 py-2 align-top text-xs leading-snug break-words w-24">{country}</td>
                                    <td className="border-2 border-black px-2 py-2 align-top text-xs leading-snug break-words w-28">{design}</td>
                                    <td className="border-2 border-black px-2 py-2 align-top text-xs leading-snug break-words w-28">{indexing}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                          <strong>
                            <em>{sourceText}</em>
                          </strong>
                        </p>
                      </div>

                      {extracted.fig2 ? (
                        <p className="text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}>
                          {extracted.fig2}
                        </p>
                      ) : null}

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

                      {extracted.fig3 ? (
                        <p className="text-black" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'justify' }}>
                          {extracted.fig3}
                        </p>
                      ) : null}

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
                          <p
                            id="phase7-fig-by-country-note"
                            className="text-xs text-neutral-700"
                            style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}
                          >
                            <strong>
                              <em>
                                {isEnglish
                                  ? 'Note: OTROS groups countries with 1 study or < 1% share.'
                                  : 'Nota: OTROS agrupa países con 1 estudio o participación < 1%.'}
                              </em>
                            </strong>
                          </p>
                        ) : null}
                        <p className="text-xs text-neutral-700" style={{ fontFamily: 'Arial', fontSize: 11, textAlign: 'left' }}>
                          <strong>
                            <em>{sourceText}</em>
                          </strong>
                        </p>
                      </div>
                    </>
                  )
                })()}
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
