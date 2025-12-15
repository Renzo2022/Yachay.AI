import { useMemo } from 'react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { ProjectProvider } from '../ProjectContext.tsx'
import type { PhaseKey } from '../types.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { phaseMetadata } from '../phaseMetadata.ts'
import { useProjectProgress } from '../hooks/useProjectProgress.ts'

const phaseEntries = Object.entries(phaseMetadata) as [PhaseKey, (typeof phaseMetadata)[PhaseKey]][]

export const ProjectLayout = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  const { project, loading, progressPercent, phaseProgress, currentPhase } = useProjectProgress(projectId)

  const currentPhaseLabel = useMemo(() => phaseMetadata[currentPhase]?.label ?? 'Fase', [currentPhase])

  if (loading) {
    return (
      <div className="min-h-screen bg-main text-text-main flex items-center justify-center font-mono text-xl">
        Cargando proyecto...
      </div>
    )
  }

  if (!project || !projectId) {
    return (
      <div className="min-h-screen bg-main text-text-main flex flex-col items-center justify-center gap-4 font-mono">
        <p>No encontramos este proyecto.</p>
        <Link to="/dashboard" className="text-accent-secondary underline">
          Volver al dashboard
        </Link>
      </div>
    )
  }

  const getPhaseState = (phaseKey: PhaseKey) => {
    const phase = phaseProgress[phaseKey]
    if (phase.completed >= phase.total) return 'done'
    if (phaseKey === currentPhase) return 'active'
    return 'locked'
  }

  return (
    <ProjectProvider value={{ project }}>
      <div className="min-h-screen bg-main text-text-main">
        <header className="border-b-4 border-white px-8 py-6 bg-main">
          <div className="flex flex-col gap-3">
            <nav className="text-sm font-mono uppercase tracking-[0.3em] text-accent-success flex flex-wrap gap-2">
              <Link to="/dashboard" className="underline text-accent-success">
                Dashboard
              </Link>
              <span>›</span>
              <span>{project.name}</span>
              <span>›</span>
              <span>{currentPhaseLabel}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h1 className="text-3xl font-black uppercase">{project.name}</h1>
                <p className="font-mono text-sm text-neutral-100">ID: {project.id}</p>
              </div>
              <div className="flex-1 min-w-[240px]">
                <p className="text-xs font-mono uppercase tracking-[0.3em] text-accent-success">Progreso global</p>
                <div className="h-4 relative bg-white border-3 border-black">
                  <div
                    className="absolute inset-y-0 left-0 bg-accent-success border-r-3 border-black"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs font-mono mt-1 text-accent-success">{progressPercent}% completado</p>
              </div>
              <BrutalButton variant="secondary" disabled className="opacity-50 cursor-not-allowed">
                Exportar
              </BrutalButton>
            </div>
          </div>
        </header>

        <div className="flex">
          <aside className="w-80 border-r-4 border-white bg-neutral-100 text-main min-h-[calc(100vh-160px)] p-6 space-y-4 border-4 border-black shadow-[6px_0_0_0_rgba(0,0,0,1)]">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 border-3 border-black px-3 py-2 font-mono text-sm bg-white hover:-translate-y-1 hover:-translate-x-1 transition-transform"
            >
              Volver al dashboard
            </Link>
            <h2 className="text-xs font-mono uppercase tracking-[0.4em] text-neutral-900">Fases</h2>
            <nav className="flex flex-col gap-3">
              {phaseEntries.map(([phaseKey, metadata]) => {
                const state = getPhaseState(phaseKey)
                const destination = `/project/${projectId}/${metadata.route}`

                const isRouteActive = location.pathname === destination
                const visualState = state === 'done' ? 'done' : isRouteActive ? 'active' : state
                const icon = visualState === 'done' ? '✅' : visualState === 'active' ? '🔵' : '🔒'
                const iconClass =
                  visualState === 'done' ? 'text-green-600' : visualState === 'active' ? 'text-blue-600' : 'text-neutral-500'

                return (
                  <NavLink
                    key={phaseKey}
                    to={destination}
                    className={({ isActive }) =>
                      [
                        'flex items-center justify-between border-3 border-black px-4 py-3 font-mono text-sm uppercase transition-transform',
                        'shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
                        isActive ? 'bg-black text-white' : 'bg-white hover:-translate-y-1 hover:-translate-x-1',
                      ].join(' ')
                    }
                  >
                    <span>{metadata.label}</span>
                    <span className={iconClass}>{icon}</span>
                  </NavLink>
                )
              })}
            </nav>

            {location.pathname.includes('/phase5') ? (
              <aside className="border-4 border-black bg-neutral-100 shadow-brutal rounded-none p-5 space-y-4">
                <header className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase text-main">Fase 5</h3>
                  <span className="text-xs font-mono uppercase tracking-[0.3em] text-black">Actividades</span>
                </header>
                <ul className="space-y-3">
                  {(
                    [
                      { id: 'phase5-1', label: 'Extraer datos de artículos' },
                      { id: 'phase5-2', label: 'Diseñar matriz de extracción' },
                      { id: 'phase5-3', label: 'Codificar datos cualitativos y cuantitativos' },
                    ] as const
                  ).map((item, index) => {
                    const completed = phaseProgress.phase5.completed
                    const done = completed >= index + 1

                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 border-3 border-black px-4 py-3 bg-white ${done ? 'bg-accent-success/30' : ''}`}
                      >
                        <span
                          className={`w-6 h-6 border-3 border-black flex items-center justify-center font-black ${
                            done ? 'bg-accent-success text-main' : 'bg-white'
                          }`}
                        >
                          {done ? '✔' : ''}
                        </span>
                        <span className="font-mono text-sm text-main">{item.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </aside>
            ) : null}

            {location.pathname.includes('/phase6') ? (
              <aside className="border-4 border-black bg-neutral-100 shadow-brutal rounded-none p-5 space-y-4">
                <header className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase text-main">Fase 6</h3>
                  <span className="text-xs font-mono uppercase tracking-[0.3em] text-black">Actividades</span>
                </header>
                <ul className="space-y-3">
                  {(
                    [
                      { id: 'phase6-1', label: 'Sintetizar resultados (temas/patrones)' },
                      { id: 'phase6-2', label: 'Detectar divergencias y vacíos' },
                      { id: 'phase6-3', label: 'Redactar síntesis narrativa' },
                    ] as const
                  ).map((item, index) => {
                    const completed = phaseProgress.phase6.completed
                    const done = completed >= index + 1

                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 border-3 border-black px-4 py-3 bg-white ${done ? 'bg-accent-success/30' : ''}`}
                      >
                        <span
                          className={`w-6 h-6 border-3 border-black flex items-center justify-center font-black ${
                            done ? 'bg-accent-success text-main' : 'bg-white'
                          }`}
                        >
                          {done ? '✔' : ''}
                        </span>
                        <span className="font-mono text-sm text-main">{item.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </aside>
            ) : null}

            {location.pathname.includes('/phase4') ? (
              <aside className="border-4 border-black bg-neutral-100 shadow-brutal rounded-none p-5 space-y-4">
                <header className="flex items-center justify-between">
                  <h3 className="text-2xl font-black uppercase text-main">Fase 4</h3>
                  <span className="text-xs font-mono uppercase tracking-[0.3em] text-black">Checklist</span>
                </header>
                <ul className="space-y-3">
                  {(
                    [
                      { id: 'phase4-1', label: 'Clasificar tipo de estudio' },
                      { id: 'phase4-2', label: 'Aplicar checklist de calidad (CASP / AMSTAR / STROBE)' },
                      { id: 'phase4-3', label: 'Asignar nivel de calidad' },
                    ] as const
                  ).map((item, index) => {
                    const completed = phaseProgress.phase4.completed
                    const done = completed >= index + 1

                    return (
                      <li
                        key={item.id}
                        className={`flex items-center gap-3 border-3 border-black px-4 py-3 bg-white ${done ? 'bg-accent-success/30' : ''}`}
                      >
                        <span
                          className={`w-6 h-6 border-3 border-black flex items-center justify-center font-black ${
                            done ? 'bg-accent-success text-main' : 'bg-white'
                          }`}
                        >
                          {done ? '✔' : ''}
                        </span>
                        <span className="font-mono text-sm text-main">{item.label}</span>
                      </li>
                    )
                  })}
                </ul>
              </aside>
            ) : null}
            <div id="phase3-checklist-slot" className="space-y-4" />
          </aside>

          <main className="flex-1 p-8 bg-white">
            <div className="max-w-6xl mx-auto border-4 border-black bg-white shadow-[8px_8px_0_0_#111] p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ProjectProvider>
  )
}
