import { useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useProject } from '../../projects/ProjectContext.tsx'
import { useReport } from '../hooks/useReport.ts'
import { GeneratorHero } from '../components/GeneratorHero.tsx'
import { ManuscriptViewer } from '../components/ManuscriptViewer.tsx'
import { ExportToolbar } from '../components/ExportToolbar.tsx'
import type { Manuscript } from '../types.ts'
import type { ManuscriptLanguage } from '../types.ts'

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
    keywordsEn,
    matrixRows,
    generating,
    progress,
    progressPercent,
    error,
    clearError,
    generateManuscript,
    regenerateManuscript,
    updateSection,
    formatReferences,
    togglePrismaChecklistValidated,
    toggleFinalSubmissionReady,
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
            <div className="mt-4 flex flex-col items-center gap-2">
              <input
                className="w-full max-w-xl border-3 border-black bg-white px-3 py-2 text-center"
                style={{ fontFamily: 'Arial', fontSize: 11 }}
                placeholder="Nombre del autor"
                value={manuscript?.authorName ?? ''}
                onChange={async (event) => {
                  await updateSection('authorName', event.target.value)
                }}
              />
              <div className="flex w-full max-w-xl items-center gap-2">
                <input
                  className="flex-1 border-3 border-black bg-white px-3 py-2 text-center"
                  style={{ fontFamily: 'Arial', fontSize: 11 }}
                  placeholder="ORCID (0000-0000-0000-0000 o URL)"
                  value={manuscript?.authorOrcid ?? ''}
                  onChange={async (event) => {
                    await updateSection('authorOrcid', event.target.value)
                  }}
                />
                {manuscript?.authorOrcid?.trim() ? (
                  <a
                    className="border-3 border-black bg-white px-3 py-2"
                    style={{ fontFamily: 'Arial', fontSize: 11, color: '#A6CE39' }}
                    href={manuscript.authorOrcid.trim().startsWith('http') ? manuscript.authorOrcid.trim() : `https://orcid.org/${manuscript.authorOrcid.trim().replace(/^orcid\.org\//i, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir ORCID"
                  >
                    iD
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <ExportToolbar
            manuscript={manuscript as Manuscript}
            projectName={project.name}
            reportTitle={reportTitle || project.name}
            keywords={keywords}
            keywordsEn={keywordsEn}
            matrixRowCount={matrixRows.length}
            onRegenerate={async (language: ManuscriptLanguage) => {
              await regenerateManuscript(language)
            }}
            regenerating={generating}
          />

          <div className="border-4 border-black bg-white shadow-[14px_14px_0_0_#111] p-4 font-mono text-sm text-black space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="border-3 border-black px-3 py-1 bg-neutral-100">
                <strong>Referencias:</strong> {manuscript?.referencesFormatted ? 'Formateadas' : 'Pendientes'}
              </span>
              <span className="border-3 border-black px-3 py-1 bg-neutral-100">
                <strong>Checklist PRISMA:</strong> {manuscript?.prismaChecklistValidated ? 'Validado' : 'Pendiente'}
              </span>
              <span className="border-3 border-black px-3 py-1 bg-neutral-100">
                <strong>Versión final:</strong> {manuscript?.finalSubmissionReady ? 'Lista' : 'Pendiente'}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-white text-black"
                onClick={async () => {
                  await formatReferences()
                }}
              >
                Formatear referencias
              </button>
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-white text-black"
                onClick={async () => {
                  await togglePrismaChecklistValidated()
                }}
              >
                Validar checklist PRISMA
              </button>
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-white text-black"
                onClick={async () => {
                  await toggleFinalSubmissionReady()
                }}
              >
                Preparar versión final
              </button>
            </div>
          </div>
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
            keywordsEn={keywordsEn}
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
