import { useMemo, useState } from 'react'
import { useProject } from '../../projects/ProjectContext.tsx'
import { useSynthesis } from '../hooks/useSynthesis.ts'
import { VisualizationsPanel } from '../components/VisualizationsPanel.tsx'
import { ThematicAnalysis } from '../components/ThematicAnalysis.tsx'
import { NarrativeEditor } from '../components/NarrativeEditor.tsx'

const tabs = [
  { id: 'visualizations', label: '📊 Visualizaciones' },
  { id: 'themes', label: '🎯 Temas y Patrones' },
  { id: 'narrative', label: '📝 Síntesis Narrativa' },
]

export const Phase6View = () => {
  const project = useProject()
  const {
    studies,
    stats,
    themes,
    narrative,
    divergences,
    gaps,
    addTheme,
    updateTheme,
    deleteTheme,
    updateNarrative,
    updateDivergences,
    updateGaps,
    generateSynthesisDraft,
    generating,
  } = useSynthesis(project.id)

  const [activeTab, setActiveTab] = useState<'visualizations' | 'themes' | 'narrative'>('visualizations')
  const [selectedYear, setSelectedYear] = useState<string | null>(null)

  const filteredStudies = useMemo(() => {
    if (!selectedYear) return studies
    return studies.filter((study) => String(study.year ?? 'NA') === selectedYear)
  }, [selectedYear, studies])

  return (
    <div className="space-y-6">
      <header className="border-4 border-black bg-white shadow-[12px_12px_0_0_#111] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#F97316]">Fase 6 · Síntesis</p>
          <h1 className="text-3xl font-black text-neutral-900">Visualiza, interpreta y redacta</h1>
          <p className="text-sm font-mono text-neutral-600 max-w-3xl">
            Explora patrones temporales y geográficos, consolida temas cualitativos y genera textos narrativos apoyados por IA.
          </p>
        </div>
        <div className="border-3 border-black px-4 py-3 bg-neutral-100">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500">Estudios incluidos</p>
          <p className="text-2xl font-black text-neutral-900">{studies.length}</p>
        </div>
      </header>

      <nav className="flex gap-3 border-4 border-black bg-white px-4 py-2 shadow-[8px_8px_0_0_#111]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 border-3 border-black font-mono text-xs uppercase tracking-tight transition-all ${
              activeTab === tab.id
                ? 'bg-[#F97316] text-white translate-x-[-2px] translate-y-[-2px]'
                : 'bg-white text-neutral-900 hover:-translate-y-1 hover:-translate-x-1'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'visualizations' ? (
        <VisualizationsPanel
          stats={stats}
          studies={studies}
          filteredStudies={filteredStudies}
          selectedYear={selectedYear}
          onYearFilter={setSelectedYear}
        />
      ) : null}

      {activeTab === 'themes' ? (
        <ThematicAnalysis
          themes={themes}
          studies={studies}
          onAdd={addTheme}
          onUpdate={updateTheme}
          onDelete={deleteTheme}
          onGenerateDraft={generateSynthesisDraft}
          generating={generating}
        />
      ) : null}

      {activeTab === 'narrative' ? (
        <NarrativeEditor
          narrative={narrative}
          divergences={divergences}
          gaps={gaps}
          onNarrativeChange={updateNarrative}
          onDivergencesChange={updateDivergences}
          onGapsChange={updateGaps}
        />
      ) : null}
    </div>
  )
}
