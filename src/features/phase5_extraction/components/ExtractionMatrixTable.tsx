import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../types.ts'

interface ExtractionMatrixRow {
  study: Candidate
  extraction?: ExtractionData
}

interface ExtractionMatrixTableProps {
  rows: ExtractionMatrixRow[]
  variant?: 'default' | 'plain' | 'compact'
}

const surnameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von'])

const extractSurnameForCitation = (raw: string) => {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''

  const commaIndex = cleaned.indexOf(',')
  if (commaIndex > 0) return cleaned.slice(0, commaIndex).trim()

  const tokens = cleaned.split(' ').filter(Boolean)
  if (!tokens.length) return ''

  const looksLikeInitial = (token: string) => {
    const t = String(token ?? '').trim()
    if (!t) return false
    if (t.endsWith('.') && t.replace(/\./g, '').length <= 3) return true
    if (/^[A-Z]$/.test(t)) return true
    return false
  }

  let end = tokens.length - 1
  while (end > 0 && looksLikeInitial(tokens[end])) end -= 1

  if (end < 0) return tokens[0]

  let start = end
  while (start - 1 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1
  if (start - 2 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1

  if (start - 1 >= 0 && surnameParticles.has(tokens[start].toLowerCase())) start -= 1

  if (start - 2 >= 0 && surnameParticles.has(tokens[end - 1]?.toLowerCase())) {
    start = end - 2
  }

  if (start < end - 2) start = end - 2
  if (start < 0) start = 0

  return tokens.slice(start, end + 1).join(' ').trim()
}

const buildAuthorYearCitation = (authors: string[], year: string | number) => {
  const yearText = year && year !== '—' ? String(year) : 'n.d.'
  const list = (authors ?? []).map((name) => String(name ?? '').trim()).filter(Boolean)
  if (!list.length) return `(${yearText})`

  if (list.length === 1) {
    const a = extractSurnameForCitation(list[0]) || list[0]
    return `(${a}, ${yearText})`
  }

  if (list.length === 2) {
    const a = extractSurnameForCitation(list[0]) || list[0]
    const b = extractSurnameForCitation(list[1]) || list[1]
    return `(${a} & ${b}, ${yearText})`
  }

  const a = extractSurnameForCitation(list[0]) || list[0]
  return `(${a}, et al., ${yearText})`
}

const statusColors: Record<ExtractionData['status'] | 'empty', string> = {
  empty: 'bg-white text-black',
  extracted: 'bg-yellow-300 text-black',
  verified: 'bg-green-300 text-black',
  not_extractable: 'bg-neutral-200 text-neutral-900',
}

export const ExtractionMatrixTable = ({ rows, variant = 'default' }: ExtractionMatrixTableProps) => {
  if (!rows.length) {
    return (
      <div className="border-4 border-dashed border-black bg-white text-center py-12 font-mono text-sm">
        No hay estudios disponibles para la matriz.
      </div>
    )
  }

  const containerClass =
    variant === 'plain' || variant === 'compact'
      ? 'bg-white overflow-auto'
      : 'border-4 border-black bg-white shadow-[10px_10px_0_0_#111] overflow-auto'

  const headerClass =
    variant === 'plain' || variant === 'compact'
      ? 'bg-neutral-100 text-black'
      : 'bg-[#FF005C] text-white sticky top-0'

  const headers =
    variant === 'compact'
      ? ['#', 'Autor/Año', 'Tipo de estudio', 'Población', 'Variables', 'Resultados']
      : [
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
        ]

  return (
    <div className={containerClass}>
      <table
        className="w-full border-collapse text-black select-text"
        style={variant === 'compact' ? { fontFamily: 'Arial', fontSize: 11 } : undefined}
      >
        <thead className={headerClass}>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className={`border-2 border-black px-4 py-3 text-left uppercase tracking-wide ${variant === 'compact' ? '' : 'text-xs'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ study, extraction }, rowIndex) => {
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

            const statusLabel = statusKey === 'verified' ? 'Verificado' : statusKey === 'not_extractable' ? 'No extraíble' : 'Pendiente'

            if (variant === 'compact') {
              const citationYear = study.year || extraction?.context?.year || ''
              const authorYear = buildAuthorYearCitation(Array.isArray(study.authors) ? study.authors : [], citationYear)
              return (
                <tr key={study.id} className="odd:bg-neutral-50">
                  <td className="border-2 border-black px-3 py-2 align-top text-center w-12">{rowIndex + 1}</td>
                  <td className="border-2 border-black px-3 py-2 align-top">
                    <p className="font-black text-black">{authorYear}</p>
                    <p className="text-neutral-700 line-clamp-2">{study.title}</p>
                  </td>
                  <td className="border-2 border-black px-3 py-2 align-top">{studyType}</td>
                  <td className="border-2 border-black px-3 py-2 align-top">{population}</td>
                  <td className="border-2 border-black px-3 py-2 align-top">{variables}</td>
                  <td className="border-2 border-black px-3 py-2 align-top">{results}</td>
                </tr>
              )
            }

            return (
              <tr key={study.id} className="odd:bg-neutral-50">
                <td className="border-2 border-black px-4 py-3">
                  <p className="text-base font-black text-black">{authors}</p>
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
                    {statusLabel}
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

export default ExtractionMatrixTable
