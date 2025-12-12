import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StudyList } from '../components/StudyList.tsx'
import { QualityStats } from '../components/QualityStats.tsx'
import { EvaluationModal } from '../components/EvaluationModal.tsx'
import { useQuality } from '../hooks/useQuality.ts'
import type { Candidate } from '../../projects/types.ts'
import type { ChecklistType, StudyType } from '../types.ts'
import { BrutalCard } from '../../../core/ui-kit/BrutalCard.tsx'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { batchSuggestQualityAssessments } from '../../../services/ai.service.ts'

export const Phase4View = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [isBatchEvaluating, setIsBatchEvaluating] = useState(false)
  const [batchStatus, setBatchStatus] = useState<string | null>(null)

  type SuggestedCriterion = {
    id: string
    answer: 'Yes' | 'Partial' | 'No'
    evidence?: string
    justification?: string
  }

  const {
    studies,
    loading,
    stats,
    calculateScore,
    determineLevel,
    saveAssessment,
    getAssessmentForStudy,
    defaultCriteria,
  } = useQuality(projectId ?? '')

  const pendingStudies = useMemo(
    () => studies.filter((study) => !getAssessmentForStudy(study.id)),
    [studies, getAssessmentForStudy],
  )

  const normalizeChecklistType = (value: unknown): ChecklistType => {
    if (value === 'AMSTAR' || value === 'STROBE' || value === 'CASP') return value
    return 'CASP'
  }

  const normalizeStudyType = (value: unknown): StudyType => {
    const allowed: StudyType[] = [
      'RCT',
      'Quasi-experimental',
      'Observational',
      'Cohort',
      'Case-control',
      'Cross-sectional',
      'Qualitative',
      'Systematic Review',
    ]
    return allowed.includes(value as StudyType) ? (value as StudyType) : 'Observational'
  }

  const handleEvaluateAllWithAI = async () => {
    if (!projectId) return
    if (!pendingStudies.length) return
    setIsBatchEvaluating(true)
    setBatchStatus('Evaluando con IA…')
    try {
      const response = await batchSuggestQualityAssessments({
        studies: pendingStudies.map((study) => ({
          id: study.id,
          title: study.title,
          abstract: study.abstract ?? '',
        })),
      })

      const results = response.results
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index]
        const checklistType = normalizeChecklistType(result.checklistType)
        const studyType = normalizeStudyType(result.studyType)

        setBatchStatus(`Guardando ${index + 1}/${results.length}…`)

        const baseCriteria = defaultCriteria(checklistType)
        const suggestedById = new Map<string, SuggestedCriterion>(
          result.criteria.map((criterion: SuggestedCriterion) => [criterion.id, criterion]),
        )
        const merged = baseCriteria.map((criterion) => {
          const suggested = suggestedById.get(criterion.id)
          return {
            ...criterion,
            answer: suggested?.answer ?? criterion.answer,
            evidence: suggested?.evidence ?? criterion.evidence,
            justification: suggested?.justification ?? criterion.justification,
          }
        })

        await saveAssessment({
          studyId: result.studyId,
          studyType,
          checklistType,
          criteria: merged,
        })
      }
      setBatchStatus('Evaluación con IA completada.')
      setTimeout(() => setBatchStatus(null), 2500)
    } catch (error) {
      console.error('handleEvaluateAllWithAI', error)
      setBatchStatus('No se pudo evaluar con IA. Revisa el proxy y COHERE_API_KEY.')
    } finally {
      setIsBatchEvaluating(false)
    }
  }

  if (!projectId) {
    return <div className="border-4 border-black bg-white p-6 font-mono text-xl">Proyecto no encontrado.</div>
  }

  if (loading) {
    return (
      <div className="border-4 border-black bg-neutral-900 text-text-main p-8 font-mono text-xl">
        Cargando evaluaciones...
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[70%_1fr] gap-8">
      <div className="space-y-6">
        <BrutalCard className="bg-white border-black">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.4em] text-purple-500">Fase 4 · Evaluación</p>
              <h2 className="text-3xl font-black text-neutral-900">Evaluación de calidad</h2>
              <p className="text-sm font-mono text-neutral-600">Clasifica el tipo de estudio y aplica CASP / AMSTAR / STROBE.</p>
            </div>
            <div className="text-right space-y-3">
              <p className="text-xs font-mono uppercase text-neutral-600">Pendientes</p>
              <p className="text-3xl font-black text-black">
                {pendingStudies.length}
              </p>
              <BrutalButton
                variant="primary"
                className="bg-neutral-900 text-white border-black"
                disabled={isBatchEvaluating || pendingStudies.length === 0}
                onClick={handleEvaluateAllWithAI}
              >
                {isBatchEvaluating ? 'Evaluando…' : '🤖 Evaluar con IA (todos)'}
              </BrutalButton>
            </div>
          </div>
          {batchStatus ? <p className="mt-4 text-sm font-mono text-neutral-700">{batchStatus}</p> : null}
        </BrutalCard>

        <StudyList
          studies={studies}
          onEvaluate={(study) => setSelected(study)}
          getAssessment={getAssessmentForStudy}
        />
      </div>

      <div className="space-y-6">
        <QualityStats stats={stats} />
      </div>

      <EvaluationModal
        open={Boolean(selected)}
        study={selected}
        existing={selected ? getAssessmentForStudy(selected.id) : undefined}
        onClose={() => {
          setSelected(null)
        }}
        saveAssessment={saveAssessment}
        calculateScore={calculateScore}
        determineLevel={determineLevel}
        defaultCriteria={defaultCriteria}
      />
    </div>
  )
}
