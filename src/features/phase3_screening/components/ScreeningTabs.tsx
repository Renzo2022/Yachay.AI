type ScreeningTabsProps = {
  activeTab: 'ai' | 'prisma'
  onChange: (tab: 'ai' | 'prisma') => void
  disabledTabs?: Partial<Record<'ai' | 'prisma', boolean>>
}

const tabs = [
  { id: 'ai', label: 'Resumen Cribado' },
  { id: 'prisma', label: 'Generar Diagrama PRISMA' },
] as const

export const ScreeningTabs = ({ activeTab, onChange, disabledTabs }: ScreeningTabsProps) => (
  <div className="flex gap-3 mb-6">
    {tabs.map((tab) => {
      const isActive = activeTab === tab.id
      const isDisabled = Boolean(disabledTabs?.[tab.id])
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            if (isDisabled) return
            onChange(tab.id)
          }}
          disabled={isDisabled}
          className={`flex-1 border-3 border-black px-4 py-3 font-mono text-sm uppercase tracking-tight text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none ${
            isDisabled
              ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
              : isActive
                ? 'bg-accent-warning'
                : 'bg-neutral-100 hover:-translate-y-1 hover:-translate-x-1 transition-transform'
          }`}
        >
          {tab.label}
        </button>
      )
    })}
  </div>
)
