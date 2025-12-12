import type { Candidate } from '../../projects/types.ts'
import type { QualityAssessment } from '../types.ts'

const levelStyles: Record<string, string> = {
  High: 'bg-accent-success text-black',
  Medium: 'bg-accent-warning text-black',
  Low: 'bg-accent-primary text-white',
}

const levelLabel: Record<string, string> = {
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
}

interface StudyListProps {
  studies: Candidate[]
  onEvaluate: (study: Candidate) => void
  getAssessment: (studyId: string) => QualityAssessment | undefined
}

export const StudyList = ({ studies, onEvaluate, getAssessment }: StudyListProps) => {
  if (!studies.length) {
    return (
      <div className="border-4 border-dashed border-purple-500 bg-white text-center py-16 px-8 shadow-[8px_8px_0_0_#111]">
        <p className="font-mono text-lg">Todavía no tienes estudios incluidos. Finaliza la Fase 3.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {studies.map((study) => {
        const assessment = getAssessment(study.id)
        const maxScore = assessment?.criteria?.length ?? 0
        const qualityScore = assessment ? `${assessment.totalScore}/${maxScore || '—'}` : '—'

        return (
          <div
            key={study.id}
            className="border-4 border-black bg-white shadow-[6px_6px_0_0_#111111] p-4 flex items-center gap-4"
          >
            <div className="flex-1">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-purple-500">{study.source}</p>
              <h3 className="text-2xl font-black text-neutral-900">{study.title}</h3>
              <p className="text-sm font-mono text-neutral-600">
                {study.authors.join(', ')} · {study.year}
              </p>
            </div>

            {assessment ? (
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`px-4 py-2 border-3 border-black font-mono text-sm uppercase tracking-wide ${
                    levelStyles[assessment.qualityLevel]
                  }`}
                >
                  {(levelLabel[assessment.qualityLevel] ?? assessment.qualityLevel)} · {qualityScore}
                </span>
                <span className="text-xs font-mono text-neutral-600">Evaluado {new Date(assessment.assessedAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  onClick={() => onEvaluate(study)}
                  className="inline-flex items-center justify-center gap-2 border-3 border-black bg-white text-black px-4 py-2 font-mono uppercase tracking-tight shadow-[4px_4px_0_0_#111] hover:-translate-y-1 hover:-translate-x-1 active:translate-x-0 active:translate-y-0"
                >
                  ✏️ Editar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => onEvaluate(study)}
                  className="inline-flex items-center justify-center gap-2 border-3 border-black bg-purple-500 text-white px-4 py-3 font-mono uppercase tracking-tight shadow-[4px_4px_0_0_#111] hover:-translate-y-1 hover:-translate-x-1 active:translate-x-0 active:translate-y-0"
                >
                  ➕ Evaluar (Manual)
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
