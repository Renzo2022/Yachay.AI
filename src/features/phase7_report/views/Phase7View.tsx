import { useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useProject } from '../../projects/ProjectContext.tsx'
import { useReport } from '../hooks/useReport.ts'
import { GeneratorHero } from '../components/GeneratorHero.tsx'
import { ManuscriptViewer } from '../components/ManuscriptViewer.tsx'
import { ExportToolbar } from '../components/ExportToolbar.tsx'
import type { Manuscript } from '../types.ts'

const fireCelebration = () => {
  confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 }, colors: ['#EF4444', '#111111', '#ffffff'] })
  if (typeof window !== 'undefined') {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    oscillator.type = 'triangle'
    oscillator.frequency.value = 880
    oscillator.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.2)
  }
}

export const Phase7View = () => {
  const project = useProject()
  const {
    manuscript,
    annexes,
    reportTitle,
    keywords,
    matrixRows,
    generating,
    progress,
    progressPercent,
    error,
    clearError,
    generateManuscript,
    regenerateManuscript,
    updateSection,
  } = useReport(project.id)

  const handleGenerate = useCallback(async () => {
    const generated = await generateManuscript()
    if (generated) fireCelebration()
  }, [generateManuscript])

  const hasManuscript = Boolean(manuscript)

  return (
    <div className="space-y-6">
      {!hasManuscript ? (
        <GeneratorHero
          generating={generating}
          progressLabel={progress?.label}
          progressPercent={progressPercent}
          onGenerate={handleGenerate}
        />
      ) : (
        <>
          <div className="border-4 border-black bg-white shadow-[14px_14px_0_0_#111] p-6">
            <h2 className="text-3xl font-black text-black text-center" style={{ fontFamily: '"Merriweather", serif' }}>
              {reportTitle || project.name}
            </h2>
          </div>
          <ExportToolbar
            manuscript={manuscript as Manuscript}
            projectName={project.name}
            reportTitle={reportTitle || project.name}
            keywords={keywords}
            matrixRowCount={matrixRows.length}
            onRegenerate={async () => {
              await regenerateManuscript()
            }}
            regenerating={generating}
          />
          <div className="border-4 border-black bg-white shadow-[14px_14px_0_0_#111] p-4 font-mono text-sm flex flex-wrap gap-4 text-black">
            <span>
              <strong>Proyecto:</strong> {project.name}
            </span>
            <span>
              <strong>Palabras:</strong> {manuscript?.wordCount ?? 0}
            </span>
            <span>
              <strong>Última generación:</strong> {manuscript ? new Date(manuscript.generatedAt).toLocaleString() : '—'}
            </span>
          </div>
          <ManuscriptViewer
            manuscript={manuscript as Manuscript}
            onChange={updateSection}
            annexes={annexes}
            keywords={keywords}
            matrixRows={matrixRows}
          />
        </>
      )}

      {error ? (
        <div className="fixed bottom-6 right-6 border-4 border-black bg-white px-4 py-3 shadow-[6px_6px_0_0_#111] font-mono text-sm">
          <p className="text-[#EF4444]">{error}</p>
          <button type="button" className="mt-2 border-3 border-black px-3 py-1" onClick={clearError}>
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  )
}
