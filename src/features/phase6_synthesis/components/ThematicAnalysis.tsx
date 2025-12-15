import { useState } from 'react'
import type { Candidate } from '../../projects/types.ts'
import type { SynthesisTheme } from '../types.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'

interface ThematicAnalysisProps {
  themes: SynthesisTheme[]
  studies: Candidate[]
  onAdd: (theme: Omit<SynthesisTheme, 'id'>) => Promise<void>
  onUpdate: (theme: SynthesisTheme) => Promise<void>
  onDelete: (themeId: string) => Promise<void>
}

export const ThematicAnalysis = ({ themes, studies, onAdd, onUpdate, onDelete }: ThematicAnalysisProps) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<SynthesisTheme, 'id'>>({
    theme: '',
    subtheme: '',
    example: '',
    studyCount: 0,
    relatedStudies: [],
  })
  const [saving, setSaving] = useState(false)

  const toggleStudy = (studyId: string) => {
    setDraft((prev) => {
      const exists = prev.relatedStudies.includes(studyId)
      return {
        ...prev,
        relatedStudies: exists ? prev.relatedStudies.filter((id) => id !== studyId) : [...prev.relatedStudies, studyId],
      }
    })
  }

  const resetDraft = () => {
    setDraft({ theme: '', subtheme: '', example: '', studyCount: 0, relatedStudies: [] })
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!draft.theme.trim()) return
    setSaving(true)
    const normalized: Omit<SynthesisTheme, 'id'> = {
      ...draft,
      studyCount: draft.relatedStudies.length,
    }
    if (editingId) {
      await onUpdate({ ...normalized, id: editingId })
    } else {
      await onAdd(normalized)
    }
    resetDraft()
    setSaving(false)
    setShowForm(false)
  }

  const startEditing = (theme: SynthesisTheme) => {
    setDraft({
      theme: theme.theme,
      subtheme: theme.subtheme,
      example: theme.example,
      studyCount: theme.studyCount,
      relatedStudies: theme.relatedStudies,
    })
    setEditingId(theme.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Temas</p>
            <h3 className="text-2xl font-black text-neutral-900">Análisis temático</h3>
          </div>
          <BrutalButton variant="primary" className="bg-[#F97316] text-white" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? 'Cerrar' : '➕ Agregar Tema'}
          </BrutalButton>
        </div>

        {showForm ? (
          <div className="mt-6 border-4 border-black bg-neutral-50 p-4 space-y-4">
            <input
              className="w-full border-3 border-black px-3 py-2 font-mono"
              placeholder="Tema"
              value={draft.theme}
              onChange={(event) => setDraft((prev) => ({ ...prev, theme: event.target.value }))}
            />
            <input
              className="w-full border-3 border-black px-3 py-2 font-mono"
              placeholder="Subtema"
              value={draft.subtheme}
              onChange={(event) => setDraft((prev) => ({ ...prev, subtheme: event.target.value }))}
            />
            <textarea
              className="w-full border-3 border-black px-3 py-2 font-mono"
              placeholder="Ejemplo (usa evidencia textual si es posible)"
              rows={3}
              value={draft.example}
              onChange={(event) => setDraft((prev) => ({ ...prev, example: event.target.value }))}
            />
            <div className="max-h-40 overflow-auto border-3 border-dashed border-black p-3 space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-600">Estudios relacionados</p>
              {studies.map((study) => {
                const checked = draft.relatedStudies.includes(study.id)
                return (
                  <label key={study.id} className="flex items-center gap-2 text-sm font-mono">
                    <input type="checkbox" checked={checked} onChange={() => toggleStudy(study.id)} />
                    <span>{study.title}</span>
                  </label>
                )
              })}
            </div>
            <div className="flex justify-end gap-3">
              <BrutalButton
                variant="secondary"
                onClick={() => {
                  setShowForm(false)
                  resetDraft()
                }}
              >
                Cancelar
              </BrutalButton>
              <BrutalButton variant="primary" className="bg-[#F97316] text-white" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar tema' : 'Guardar tema'}
              </BrutalButton>
            </div>
          </div>
        ) : null}
      </section>

      <section className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] p-6 overflow-auto">
        <header className="mb-4">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#F97316]">Tabla de temas</p>
          <h3 className="text-2xl font-black text-neutral-900">Tema | Subtema | Nº de estudios | Ejemplo</h3>
        </header>
        {themes.length === 0 ? (
          <p className="font-mono text-sm text-neutral-600">Aún no has agregado temas. Usa el botón superior para registrar patrones.</p>
        ) : (
          <table className="w-full border-collapse text-black">
            <thead>
              <tr className="bg-neutral-100 text-black">
                <th className="border-3 border-black px-3 py-2 text-left font-mono text-xs uppercase">Tema</th>
                <th className="border-3 border-black px-3 py-2 text-left font-mono text-xs uppercase">Subtema</th>
                <th className="border-3 border-black px-3 py-2 text-left font-mono text-xs uppercase">Nº de estudios</th>
                <th className="border-3 border-black px-3 py-2 text-left font-mono text-xs uppercase">Ejemplo</th>
                <th className="border-3 border-black px-3 py-2 text-left font-mono text-xs uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => (
                <tr key={theme.id} className="bg-white">
                  <td className="border-3 border-black px-3 py-2 font-mono text-sm">{theme.theme}</td>
                  <td className="border-3 border-black px-3 py-2 font-mono text-sm">{theme.subtheme}</td>
                  <td className="border-3 border-black px-3 py-2 font-mono text-sm">{theme.studyCount}</td>
                  <td className="border-3 border-black px-3 py-2 font-mono text-sm">{theme.example}</td>
                  <td className="border-3 border-black px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="border-3 border-black px-3 py-1 font-mono text-xs"
                        onClick={() => startEditing(theme)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="border-3 border-black px-3 py-1 font-mono text-xs bg-red-500 text-white"
                        onClick={() => onDelete(theme.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
