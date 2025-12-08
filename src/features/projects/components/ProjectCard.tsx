import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, PhaseKey } from '../types.ts'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { cn } from '../../../utils/cn.ts'
import { phaseMetadata } from '../phaseMetadata.ts'

type ProjectCardProps = {
  project: Project
  onDelete?: (project: Project) => void
}

export const ProjectCard = ({ project, onDelete }: ProjectCardProps) => {
  const navigate = useNavigate()

  const progress = useMemo(() => {
    if (!project.totalTasks) return 0
    return Math.min(100, Math.round((project.completedTasks / project.totalTasks) * 100))
  }, [project.completedTasks, project.totalTasks])

  const currentPhase: PhaseKey = project.currentPhase ?? 'phase1'
  const phaseInfo = phaseMetadata[currentPhase]

  const formattedDate = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(project.updatedAt)

  return (
    <article
      className={cn(
        'border-4 border-black bg-white p-5 rounded-none',
        'shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]',
        'flex flex-col gap-4 transition-transform duration-150',
        'hover:-translate-y-1 hover:-translate-x-1',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-black">
              Actualizado: {formattedDate}
            </p>
            <h3 className="text-2xl font-black uppercase text-main">{project.name}</h3>
            <p className="text-sm font-mono text-neutral-600">
              En curso: <span className="font-black" style={{ color: phaseInfo.accent }}>{phaseInfo.label}</span>
            </p>
          </div>

          <BrutalButton
            variant="danger"
            size="sm"
            className="min-w-[120px]"
            onClick={() => onDelete?.(project)}
          >
            ✖ Eliminar
          </BrutalButton>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm font-mono text-main mb-2">
          <span>Progreso</span>
          <span>{progress}%</span>
        </div>
        <div className="border-3 border-black h-5 relative bg-neutral-100">
          <div
            className="absolute inset-y-0 left-0 bg-accent-success transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <BrutalButton
        variant="secondary"
        onClick={() => navigate(`/project/${project.id}/${phaseInfo.route}`)}
        className="flex items-center justify-center gap-2"
      >
        Abrir fase
      </BrutalButton>
    </article>
  )
}
