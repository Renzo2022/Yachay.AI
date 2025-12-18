import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from 'recharts'
import type { SynthesisStats } from '../analytics.ts'
import type { Candidate } from '../../projects/types.ts'

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

interface VisualizationsPanelProps {
  stats: SynthesisStats
  studies: Candidate[]
  filteredStudies: Candidate[]
  onYearFilter?: (year: string | null) => void
  selectedYear?: string | null
}

export const VisualizationsPanel = ({ stats, studies, filteredStudies, onYearFilter, selectedYear }: VisualizationsPanelProps) => {
  const handleBarClick = (data: { name?: string }) => {
    if (!onYearFilter) return
    const year = data?.name
    onYearFilter(selectedYear === year ? null : year ?? null)
  }

  const totalCountry = stats.byCountry.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0)
  const rawByCountry = stats.byCountry.map((item) => {
    const value = typeof item.value === 'number' ? item.value : 0
    const percent = totalCountry > 0 ? value / totalCountry : 0
    return { ...item, value, percent }
  })

  const { byCountry, hasOtherBucket } = (() => {
    const minor = rawByCountry.filter((item) => item.value <= 1 || item.percent < 0.01)
    const major = rawByCountry.filter((item) => !(item.value <= 1 || item.percent < 0.01))

    if (!minor.length) return { byCountry: rawByCountry, hasOtherBucket: false }

    const othersValue = minor.reduce((sum, item) => sum + item.value, 0)
    const othersPercent = totalCountry > 0 ? othersValue / totalCountry : 0
    const others = { name: OTHER_COUNTRY_LABEL, value: othersValue, percent: othersPercent }

    return {
      byCountry: [...major, others].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      hasOtherBucket: true,
    }
  })()

  const countryChartHeight = Math.max(240, byCountry.length * 26 + 20)

  const renderCountryBarLabel = (props: any) => {
    const { x, y, width, height, index } = props
    const entry = byCountry[index]
    if (!entry) return null
    const label = `${entry.value} (${(entry.percent * 100).toFixed(0)}%)`

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
    <div className="space-y-6">
      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Publicaciones</p>
            <h3 className="text-2xl font-black text-neutral-900">Distribución por año</h3>
          </div>
          <div className="font-mono text-sm text-neutral-600">
            Selección actual: {selectedYear ?? 'Todas'} ({filteredStudies.length}/{studies.length})
          </div>
        </header>
        <div className="h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={stats.byYear} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#111" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#111" />
              <YAxis stroke="#111" allowDecimals={false} />
              <Bar dataKey="count" fill="#F97316" stroke="#111" strokeWidth={2} onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 min-w-0">
        <header className="mb-4">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Distribución geográfica</p>
          <h3 className="text-2xl font-black text-neutral-900">Países</h3>
          {hasOtherBucket ? (
            <p className="mt-1 text-xs font-mono text-neutral-600">
              {OTHER_COUNTRY_LABEL} agrupa países con 1 estudio o participación &lt; 1%.
            </p>
          ) : null}
        </header>
        <div className="max-h-[520px] overflow-auto min-w-0">
          <div style={{ height: countryChartHeight }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
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
                  {byCountry.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={colorForCountry(String(entry.name ?? ''))} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6">
        <header className="mb-3">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Estudios filtrados</p>
          <h3 className="text-2xl font-black text-neutral-900">Cohorte actual</h3>
        </header>
        {filteredStudies.length === 0 ? (
          <p className="font-mono text-sm text-neutral-600">No hay estudios para el filtro aplicado.</p>
        ) : (
          <ul className="grid md:grid-cols-2 gap-3">
            {filteredStudies.map((study) => (
              <li key={study.id} className="border-3 border-black px-4 py-3 bg-neutral-50 shadow-[4px_4px_0_0_#111]">
                <p className="font-bold text-neutral-900">{study.title}</p>
                <p className="text-xs text-neutral-600">{study.authors.join(', ')} · {study.year}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
