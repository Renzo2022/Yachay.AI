import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import type { SynthesisStats } from '../analytics.ts'
import type { Candidate } from '../../projects/types.ts'

const PIE_COLORS = ['#F97316', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']

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
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={stats.byYear} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#111" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#111" />
              <YAxis stroke="#111" allowDecimals={false} />
              <Bar dataKey="count" fill="#F97316" stroke="#111" strokeWidth={2} onClick={handleBarClick} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 min-w-0">
          <header className="mb-4">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Distribución geográfica</p>
            <h3 className="text-2xl font-black text-neutral-900">Países</h3>
          </header>
          <div className="h-60 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={stats.byCountry}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={0}
                  outerRadius={88}
                  stroke="#111"
                  strokeWidth={2}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {stats.byCountry.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6">
          <header className="mb-4">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Forest Plot</p>
            <h3 className="text-2xl font-black text-neutral-900">Efectos agregados</h3>
          </header>
          <div className="h-60 overflow-auto">
            <svg width="100%" height={stats.forest.length * 40 + 40}>
              {stats.forest.map((item, index) => {
                const y = 20 + index * 40
                const minX = 40
                const width = 360
                const scale = (value: number) => minX + ((value + 1) / 2) * width
                return (
                  <g key={item.id} transform={`translate(0, ${y})`}>
                    <line x1={minX} x2={minX + width} y1={0} y2={0} stroke="#111" strokeDasharray="4 4" />
                    <line x1={scale(item.lower)} x2={scale(item.upper)} y1={0} y2={0} stroke="#111" strokeWidth={3} />
                    <circle cx={scale(item.effect)} cy={0} r={6} fill="#F97316" stroke="#111" strokeWidth={2} />
                    <text x={minX + width + 12} y={5} fontSize={12} fontFamily="JetBrains Mono" fill="#111">
                      {item.title}
                    </text>
                  </g>
                )
              })}
            </svg>
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
