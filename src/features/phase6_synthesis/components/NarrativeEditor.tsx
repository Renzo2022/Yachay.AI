import { useEffect, useState } from 'react'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'

interface NarrativeEditorProps {
  narrative: string
  divergences: string[]
  gaps: string[]
  onNarrativeChange: (value: string) => Promise<void>
  onDivergencesChange: (divergences: string[]) => Promise<void>
  onGapsChange: (gaps: string[]) => Promise<void>
  onGenerateDraft: () => Promise<void>
  generating: boolean
}

export const NarrativeEditor = ({
  narrative,
  divergences,
  gaps,
  onNarrativeChange,
  onDivergencesChange,
  onGapsChange,
  onGenerateDraft,
  generating,
}: NarrativeEditorProps) => {
  const [localNarrative, setLocalNarrative] = useState(narrative)
  const [localDivergences, setLocalDivergences] = useState(divergences)
  const [localGaps, setLocalGaps] = useState(gaps)
  const [newDivergence, setNewDivergence] = useState('')
  const [newGap, setNewGap] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalNarrative(narrative)
  }, [narrative])

  useEffect(() => {
    setLocalGaps(gaps)
  }, [gaps])

  useEffect(() => {
    setLocalDivergences(divergences)
  }, [divergences])

  const syncNarrative = async (value: string) => {
    setLocalNarrative(value)
    setSaving(true)
    await onNarrativeChange(value)
    setSaving(false)
  }

  const addGap = async () => {
    if (!newGap.trim()) return
    const updated = [newGap.trim(), ...localGaps]
    setLocalGaps(updated)
    setNewGap('')
    await onGapsChange(updated)
  }

  const addDivergence = async () => {
    if (!newDivergence.trim()) return
    const updated = [newDivergence.trim(), ...localDivergences]
    setLocalDivergences(updated)
    setNewDivergence('')
    await onDivergencesChange(updated)
  }

  const updateDivergence = async (index: number, value: string) => {
    const updated = localDivergences.map((item, idx) => (idx === index ? value : item))
    setLocalDivergences(updated)
    await onDivergencesChange(updated)
  }

  const deleteDivergence = async (index: number) => {
    const updated = localDivergences.filter((_, idx) => idx !== index)
    setLocalDivergences(updated)
    await onDivergencesChange(updated)
  }

  const updateGap = async (index: number, value: string) => {
    const updated = localGaps.map((gap, idx) => (idx === index ? value : gap))
    setLocalGaps(updated)
    await onGapsChange(updated)
  }

  const deleteGap = async (index: number) => {
    const updated = localGaps.filter((_, idx) => idx !== index)
    setLocalGaps(updated)
    await onGapsChange(updated)
  }

  return (
    <div className="space-y-6">
      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6">
        <header className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Narrativa</p>
            <h3 className="text-2xl font-black">Síntesis narrativa</h3>
          </div>
          <BrutalButton variant="primary" className="bg-[#F97316] text-white" onClick={onGenerateDraft} disabled={generating}>
            {generating ? 'Generando...' : '🤖 Generar síntesis con IA'}
          </BrutalButton>
        </header>
        <textarea
          className="w-full min-h-[240px] border-4 border-black bg-neutral-50 p-4 font-mono text-sm"
          value={localNarrative}
          onChange={(event) => syncNarrative(event.target.value)}
          placeholder="Describe los hallazgos clave, patrones y vacíos..."
        />
        {saving ? <p className="text-xs font-mono text-neutral-500 mt-2">Guardando cambios...</p> : null}
      </section>

      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 space-y-4">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Divergencias</p>
          <h3 className="text-2xl font-black">Convergencias y divergencias</h3>
        </header>
        <div className="flex gap-3">
          <input
            className="flex-1 border-3 border-black px-3 py-2 font-mono"
            placeholder="Ej. Resultados difieren según región o método"
            value={newDivergence}
            onChange={(event) => setNewDivergence(event.target.value)}
          />
          <BrutalButton variant="primary" className="bg-[#F97316] text-white" onClick={addDivergence}>
            Agregar
          </BrutalButton>
        </div>
        <ul className="space-y-3">
          {localDivergences.length === 0 ? (
            <li className="font-mono text-sm text-neutral-500">Sin divergencias registradas.</li>
          ) : (
            localDivergences.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-center gap-3">
                <input
                  className="flex-1 border-3 border-black px-3 py-2 font-mono text-sm"
                  value={item}
                  onChange={(event) => updateDivergence(index, event.target.value)}
                />
                <button
                  type="button"
                  className="border-3 border-black px-3 py-2 bg-red-500 text-white font-mono"
                  onClick={() => deleteDivergence(index)}
                >
                  Quitar
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 space-y-4">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Vacíos de evidencia</p>
          <h3 className="text-2xl font-black">Gap analysis</h3>
        </header>
        <div className="flex gap-3">
          <input
            className="flex-1 border-3 border-black px-3 py-2 font-mono"
            placeholder="Ej. Falta evidencia en contextos rurales"
            value={newGap}
            onChange={(event) => setNewGap(event.target.value)}
          />
          <BrutalButton variant="primary" className="bg-[#F97316] text-white" onClick={addGap}>
            Agregar
          </BrutalButton>
        </div>
        <ul className="space-y-3">
          {localGaps.length === 0 ? (
            <li className="font-mono text-sm text-neutral-500">Sin vacíos registrados.</li>
          ) : (
            localGaps.map((gap, index) => (
              <li key={`${gap}-${index}`} className="flex items-center gap-3">
                <input
                  className="flex-1 border-3 border-black px-3 py-2 font-mono text-sm"
                  value={gap}
                  onChange={(event) => updateGap(index, event.target.value)}
                />
                <button
                  type="button"
                  className="border-3 border-black px-3 py-2 bg-red-500 text-white font-mono"
                  onClick={() => deleteGap(index)}
                >
                  Quitar
                </button>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
