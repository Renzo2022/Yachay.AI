import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, CartesianGrid } from 'recharts'
import type { SynthesisStats } from '../analytics.ts'
import type { Candidate } from '../../projects/types.ts'

const PIE_COLORS = ['#F97316', '#FFB703', '#FB5607', '#FF006E', '#8338EC', '#3A86FF']

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
  const byCountry = stats.byCountry.map((item) => {
    const value = typeof item.value === 'number' ? item.value : 0
    const percent = totalCountry > 0 ? value / totalCountry : 0
    return { ...item, value, percent }
  })

  const renderCountryBarLabel = (props: any) => {
    const { x, y, width, height, index } = props
    const entry = byCountry[index]
    if (!entry) return null
    const label = `${entry.name} ${(entry.percent * 100).toFixed(0)}%`
    return (
      <text
        x={(x ?? 0) + (width ?? 0) + 8}
        y={(y ?? 0) + (height ?? 0) / 2}
        dominantBaseline="middle"
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
              <BarChart data={byCountry} layout="vertical" margin={{ top: 0, right: 140, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#111" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#111" allowDecimals={false} />
                <YAxis type="category" dataKey="name" hide />
                <Bar dataKey="value" stroke="#111" strokeWidth={2} label={renderCountryBarLabel}>
                  {byCountry.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
