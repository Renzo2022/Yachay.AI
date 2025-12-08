import { useState } from 'react'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { BrutalInput } from '../../../core/ui-kit/BrutalInput.tsx'
import type { ExternalSource } from '../types.ts'

type SearchHeaderProps = {
  defaultQuestion: string
  onSearch: (query: string, sources: ExternalSource[]) => void
  onGenerateStrategies: () => void
  disabled?: boolean
}

const SOURCE_OPTIONS: { label: string; value: ExternalSource }[] = [
  { label: 'Semantic Scholar', value: 'semantic_scholar' },
  { label: 'PubMed', value: 'pubmed' },
  { label: 'CrossRef', value: 'crossref' },
  { label: 'Europe PMC', value: 'europe_pmc' },
]

export const SearchHeader = ({ defaultQuestion, onSearch, onGenerateStrategies, disabled }: SearchHeaderProps) => {
  const [query, setQuery] = useState(defaultQuestion)
  const [sources, setSources] = useState<ExternalSource[]>(SOURCE_OPTIONS.map((option) => option.value))

  const handleToggleSource = (source: ExternalSource) => {
    setSources((prev) => (prev.includes(source) ? prev.filter((entry) => entry !== source) : [...prev, source]))
  }

  return (
    <section className="border-4 border-black bg-accent-success/20 p-6 shadow-brutal rounded-none space-y-4">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-main">Fase 2 · Búsqueda federada</p>
        <h2 className="text-3xl font-black uppercase text-main">Configura tu búsqueda</h2>
      </header>

      <BrutalInput
        label="Pregunta principal"
        multiline
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        badge="PICO"
      />

      <div className="flex flex-wrap gap-3 font-mono text-sm text-main">
        {SOURCE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 border-3 border-black px-4 py-2 cursor-pointer bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            <input
              type="checkbox"
              checked={sources.includes(option.value)}
              onChange={() => handleToggleSource(option.value)}
              className="appearance-none w-5 h-5 border-3 border-black bg-white checked:bg-accent-success checked:border-black cursor-pointer"
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <BrutalButton
          variant="secondary"
          className="bg-accent-success text-main border-black flex-1"
          onClick={() => onSearch(query, sources)}
          disabled={!query.trim() || sources.length === 0 || disabled}
        >
          🚀 Buscar Papers
        </BrutalButton>
        <BrutalButton variant="primary" className="flex-1" onClick={onGenerateStrategies} disabled={disabled}>
          ✨ Generar Estrategias
        </BrutalButton>
      </div>
    </section>
  )
}
