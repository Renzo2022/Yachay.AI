import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'

interface GeneratorHeroProps {
  generating: boolean
  progressLabel?: string | null
  progressPercent?: number
  onGenerate: () => Promise<void>
}

export const GeneratorHero = ({ generating, progressLabel, progressPercent = 0, onGenerate }: GeneratorHeroProps) => {
  return (
    <section className="border-4 border-black bg-white shadow-[14px_14px_0_0_#111] p-8 flex flex-col gap-6">
      <div>
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-[#EF4444]">Fase 7 · Reporte Final</p>
        <h1 className="text-4xl font-black text-neutral-900">Genera el manuscrito PRISMA 2020</h1>
        <p className="mt-3 text-sm font-mono text-neutral-700 max-w-3xl">
          Compilaremos protocolo, búsquedas, PRISMA, calidad, extracción y síntesis narrativa para redactar el informe
          final. La IA seguirá la estructura IMRyD con tono académico formal.
        </p>
      </div>

      <BrutalButton
        variant="primary"
        className="bg-[#EF4444] text-white text-2xl px-12 py-5 tracking-[0.3em]"
        onClick={onGenerate}
        disabled={generating}
      >
        {generating ? 'Generando…' : '🤖 GENERAR MANUSCRITO FINAL'}
      </BrutalButton>

      {generating ? (
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono uppercase">
            <span>{progressLabel ?? 'Iniciando…'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-4 border-4 border-black bg-white">
            <div className="h-full bg-[#EF4444]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
    </section>
  )
}
