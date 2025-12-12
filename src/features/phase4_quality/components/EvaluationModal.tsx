import { useEffect, useMemo, useState } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type { CaspCriterion, CaspAnswer, ChecklistType, QualityAssessment, StudyType } from '../types.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'

const checklistTypes: ChecklistType[] = ['CASP', 'AMSTAR', 'STROBE']

const studyTypes: StudyType[] = [
  'RCT',
  'Quasi-experimental',
  'Observational',
  'Cohort',
  'Case-control',
  'Cross-sectional',
  'Qualitative',
  'Systematic Review',
]

const answerOptions: { label: string; value: CaspAnswer; className: string }[] = [
  { label: 'CUMPLE', value: 'Yes', className: 'bg-green-400 text-black' },
  { label: 'PARCIAL', value: 'Partial', className: 'bg-yellow-300 text-black' },
  { label: 'NO CUMPLE', value: 'No', className: 'bg-red-500 text-white' },
]

const answerLabel: Record<CaspAnswer, string> = {
  Yes: 'Cumple',
  Partial: 'Parcial',
  No: 'No cumple',
}

const levelLabel: Record<string, string> = {
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
}

interface EvaluationModalProps {
  open: boolean
  study: Candidate | null
  onClose: () => void
  saveAssessment: (payload: {
    studyId: string
    studyType: StudyType
    checklistType: ChecklistType
    criteria: CaspCriterion[]
    assessmentId?: string
  }) => Promise<void>
  calculateScore: (criteria: CaspCriterion[]) => number
  determineLevel: (score: number, maxScore: number) => QualityAssessment['qualityLevel']
  defaultCriteria: (checklistType: ChecklistType) => CaspCriterion[]
  existing?: QualityAssessment
}

export const EvaluationModal = ({
  open,
  study,
  onClose,
  saveAssessment,
  calculateScore,
  determineLevel,
  defaultCriteria,
  existing,
}: EvaluationModalProps) => {
  const [studyType, setStudyType] = useState<StudyType>('RCT')
  const [checklistType, setChecklistType] = useState<ChecklistType>('CASP')
  const [criteria, setCriteria] = useState<CaspCriterion[]>(() => defaultCriteria('CASP'))
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !study) return
    const nextChecklistType = existing?.checklistType ?? 'CASP'
    setChecklistType(nextChecklistType)
    setStudyType(existing?.studyType ?? 'RCT')
    setCriteria(existing?.criteria ?? defaultCriteria(nextChecklistType))
  }, [open, study, existing, defaultCriteria])

  const score = useMemo(() => calculateScore(criteria), [criteria, calculateScore])
  const level = useMemo(() => determineLevel(score, criteria.length), [score, criteria.length, determineLevel])

  const updateAnswer = (criterionId: string, value: CaspAnswer) => {
    setCriteria((prev) =>
      prev.map((criterion) =>
        criterion.id === criterionId
          ? {
              ...criterion,
              answer: value,
            }
          : criterion,
      ),
    )
  }

  const updateNotes = (criterionId: string, notes: string) => {
    setCriteria((prev) =>
      prev.map((criterion) => (criterion.id === criterionId ? { ...criterion, notes } : criterion)),
    )
  }

  const updateEvidence = (criterionId: string, evidence: string) => {
    setCriteria((prev) =>
      prev.map((criterion) => (criterion.id === criterionId ? { ...criterion, evidence } : criterion)),
    )
  }

  const updateJustification = (criterionId: string, justification: string) => {
    setCriteria((prev) =>
      prev.map((criterion) => (criterion.id === criterionId ? { ...criterion, justification } : criterion)),
    )
  }

  const handleSave = async () => {
    if (!study) return
    setIsSaving(true)
    try {
      await saveAssessment({
        studyId: study.id,
        studyType,
        checklistType,
        criteria,
        assessmentId: existing?.id,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !study) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl border-4 border-black bg-neutral-50 shadow-[12px_12px_0_0_#111] max-h-[90vh] overflow-y-auto">
        <header className="border-b-4 border-black bg-purple-500 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em]">Evaluando</p>
            <h2 className="text-2xl font-black">{study.title}</h2>
          </div>
          <button onClick={onClose} className="font-mono text-xl border-3 border-white px-3 py-1">
            ✕
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div className="border-3 border-black bg-white shadow-[4px_4px_0_0_#111] p-4 space-y-2">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-600">Resumen</p>
            <p className="font-mono text-sm text-neutral-900 whitespace-pre-wrap">{study.abstract?.trim() || 'Sin resumen.'}</p>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.3em] mb-2">Checklist</label>
            <div className="grid grid-cols-3 gap-3">
              {checklistTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`border-3 border-black px-4 py-3 font-mono uppercase tracking-tight shadow-[4px_4px_0_0_#111] transition-transform ${
                    checklistType === type
                      ? 'bg-purple-500 text-black translate-x-[-2px] translate-y-[-2px]'
                      : 'bg-white text-black'
                  }`}
                  onClick={() => {
                    setChecklistType(type)
                    const shouldReuseExisting = Boolean(existing && existing.checklistType === type)
                    setCriteria(shouldReuseExisting ? (existing?.criteria ?? defaultCriteria(type)) : defaultCriteria(type))
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-[0.3em] mb-2">Tipo de estudio</label>
            <div className="grid grid-cols-2 gap-3">
              {studyTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`border-3 border-black px-4 py-3 font-mono uppercase tracking-tight shadow-[4px_4px_0_0_#111] transition-transform ${
                    studyType === type
                      ? 'bg-purple-500 text-black translate-x-[-2px] translate-y-[-2px]'
                      : 'bg-white text-black'
                  }`}
                  onClick={() => setStudyType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {criteria.map((criterion) => (
              <div key={criterion.id} className="border-3 border-black bg-white shadow-[4px_4px_0_0_#111] p-4 space-y-3">
                <p className="font-bold text-lg text-neutral-900">{criterion.question}</p>
                <div className="flex flex-wrap gap-3">
                  {answerOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateAnswer(criterion.id, option.value)}
                      className={`px-4 py-3 border-3 border-black font-mono uppercase tracking-tight ${
                        option.className
                      } shadow-[4px_4px_0_0_#111] transition-transform ${
                        criterion.answer === option.value ? 'translate-x-[-2px] translate-y-[-2px]' : 'bg-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full border-3 border-black bg-neutral-100 p-3 font-mono text-sm"
                  placeholder="Evidencia textual (cita del título/resumen)"
                  rows={2}
                  value={criterion.evidence ?? ''}
                  onChange={(event) => updateEvidence(criterion.id, event.target.value)}
                />
                <textarea
                  className="w-full border-3 border-black bg-neutral-100 p-3 font-mono text-sm"
                  placeholder="Justificación (por qué cumple / parcial / no cumple)"
                  rows={2}
                  value={criterion.justification ?? ''}
                  onChange={(event) => updateJustification(criterion.id, event.target.value)}
                />
                <textarea
                  className="w-full border-3 border-black bg-neutral-100 p-3 font-mono text-sm"
                  placeholder="Notas opcionales..."
                  rows={2}
                  value={criterion.notes ?? ''}
                  onChange={(event) => updateNotes(criterion.id, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="border-3 border-black bg-white shadow-[4px_4px_0_0_#111] p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-600">Tabla de resultados</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm font-mono">
                <thead className="bg-neutral-100 text-black uppercase tracking-[0.2em] text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Criterio</th>
                    <th className="px-3 py-2 text-left">Cumplimiento</th>
                    <th className="px-3 py-2 text-left">Evidencia</th>
                    <th className="px-3 py-2 text-left">Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((criterion) => (
                    <tr key={`table-${criterion.id}`} className="border-t border-neutral-200">
                      <td className="px-3 py-2 text-neutral-900">{criterion.question}</td>
                      <td className="px-3 py-2 text-neutral-900">{answerLabel[criterion.answer] ?? criterion.answer}</td>
                      <td className="px-3 py-2 text-neutral-700 whitespace-pre-wrap">{criterion.evidence ?? ''}</td>
                      <td className="px-3 py-2 text-neutral-700 whitespace-pre-wrap">{criterion.justification ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <footer className="border-t-4 border-black bg-neutral-900 text-white px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="font-mono text-lg">
            Puntaje actual:{' '}
            <span className="text-3xl font-black tracking-tight">{score.toFixed(1)}</span>
            <span className="text-sm ml-2 uppercase">/ {criteria.length} · {levelLabel[level] ?? level}</span>
          </div>
          <div className="ml-auto flex gap-3">
            <BrutalButton variant="secondary" onClick={onClose} className="bg-white text-black border-black">
              Cancelar
            </BrutalButton>
            <BrutalButton
              variant="primary"
              className="bg-purple-500 text-white border-black"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : 'Guardar evaluación'}
            </BrutalButton>
          </div>
        </footer>
      </div>
    </div>
  )
}
