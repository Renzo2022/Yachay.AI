import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../types.ts'

interface ExtractionMatrixRow {
  study: Candidate
  extraction?: ExtractionData
}

interface ExtractionMatrixTableProps {
  rows: ExtractionMatrixRow[]
}

const statusColors: Record<ExtractionData['status'] | 'empty', string> = {
  empty: 'bg-white text-black',
  extracted: 'bg-yellow-300 text-black',
  verified: 'bg-green-300 text-black',
}

export const ExtractionMatrixTable = ({ rows }: ExtractionMatrixTableProps) => {
  if (!rows.length) {
    return (
      <div className="border-4 border-dashed border-black bg-white text-center py-12 font-mono text-sm">
        No hay estudios disponibles para la matriz.
      </div>
    )
  }

  return (
    <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] overflow-auto">
      <table className="w-full border-collapse font-mono text-sm text-black">
        <thead className="bg-[#FF005C] text-white sticky top-0">
          <tr>
            {[
              'Autor',
              'Año',
              'País',
              'Tipo de estudio',
              'Población',
              'Variables',
              'Resultados',
              'Conclusiones',
              'Nivel de evidencia',
              'Estado',
            ].map((header) => (
              <th key={header} className="border-2 border-black px-4 py-3 text-left uppercase tracking-wide text-xs">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ study, extraction }) => {
            const statusKey = extraction?.status ?? 'empty'
            const authors = Array.isArray(study.authors) && study.authors.length ? study.authors.join(', ') : '—'
            const year = study.year || extraction?.context?.year || '—'
            const country = extraction?.context?.country?.trim() ? extraction.context.country.trim() : '—'
            const studyType = study.studyType ?? '—'
            const population = extraction?.sample?.description?.trim() ? extraction.sample.description.trim() : '—'
            const variables = extraction?.variables?.length ? extraction.variables.join(', ') : '—'
            const results = extraction?.outcomes?.results?.trim() ? extraction.outcomes.results.trim() : '—'
            const conclusions = extraction?.conclusions?.trim() ? extraction.conclusions.trim() : '—'
            const evidenceLevel = study.qualityLevel ?? '—'
            return (
              <tr key={study.id} className="odd:bg-neutral-50">
                <td className="border-2 border-black px-4 py-3">
                  <p className="text-base font-black text-neutral-900">{authors}</p>
                  <p className="text-xs text-neutral-600 line-clamp-2">{study.title}</p>
                </td>
                <td className="border-2 border-black px-4 py-3">
                  {year}
                </td>
                <td className="border-2 border-black px-4 py-3">{country}</td>
                <td className="border-2 border-black px-4 py-3">{studyType}</td>
                <td className="border-2 border-black px-4 py-3">{population}</td>
                <td className="border-2 border-black px-4 py-3">{variables}</td>
                <td className="border-2 border-black px-4 py-3">{results}</td>
                <td className="border-2 border-black px-4 py-3">{conclusions}</td>
                <td className="border-2 border-black px-4 py-3">{evidenceLevel}</td>
                <td className="border-2 border-black px-4 py-3">
                  <span className={`inline-flex items-center justify-center px-3 py-1 border-2 border-black text-xs uppercase tracking-wide ${statusColors[statusKey]}`}>
                    {statusKey === 'empty' ? 'Pendiente' : statusKey}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
