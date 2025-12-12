import { useEffect, useMemo, useState } from 'react'
import { BrutalButton } from '../../../core/ui-kit/BrutalButton.tsx'
import { useAuth } from '../../auth/AuthContext.tsx'
import type { Project } from '../types.ts'
import { createProject, deleteProject, listenToProjects } from '../project.service.ts'
import { ProjectCard } from '../components/ProjectCard.tsx'
import { CreateProjectModal } from '../components/CreateProjectModal.tsx'
import { TemplateSelector } from '../components/TemplateSelector.tsx'
import type { GeneratedProtocolPayload } from '../../../services/ai.service.ts'
import { useToast } from '../../../core/toast/ToastProvider.tsx'

export const DashboardView = () => {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (!user) return
    const unsubscribe = listenToProjects(user.uid, (items) => {
      setProjects(items)
      setLoading(false)
    })

    return unsubscribe
  }, [user])

  if (!user) return null

  const handleCreateProject = async (name: string) => {
    await createProject(user.uid, { name })
  }

  const handleTemplateGenerated = async (templateId: string, payload: GeneratedProtocolPayload) => {
    await createProject(user.uid, {
      name: payload.topic,
      templateUsed: templateId,
      phase1: {
        mainQuestion: payload.protocol.mainQuestion,
        subquestions: [],
        objectives: '',
        coherenceAnalysis: '',
        methodologicalJustification: '',
        pico: payload.protocol.pico,
        inclusionCriteria: payload.protocol.inclusionCriteria,
        exclusionCriteria: payload.protocol.exclusionCriteria,
      },
      completedTasks: 3,
    })
    setStatusMessage('Protocolo IA listo. Proyecto creado 🚀')
    setTimeout(() => setStatusMessage(null), 4000)
  }

  const hasProjects = projects.length > 0
  const orderedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [projects])

  const confirmDelete = (project: Project) => {
    setProjectPendingDelete(project)
  }

  const cancelDelete = () => {
    setProjectPendingDelete(null)
  }

  const handleDelete = async () => {
    if (!projectPendingDelete) return
    try {
      setDeleting(true)
      await deleteProject(projectPendingDelete.id)
      showToast({
        type: 'success',
        message: `Proyecto "${projectPendingDelete.name}" eliminado.`,
      })
      setProjectPendingDelete(null)
    } catch (error) {
      console.error('deleteProject error', error)
      showToast({
        type: 'error',
        message: 'No se pudo eliminar el proyecto. Intenta de nuevo.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-mono uppercase tracking-[0.4em] text-black">Fase 0 · Dashboard</p>
          <h1 className="text-4xl font-black uppercase">Centro de Proyectos</h1>
        </div>
        <div className="flex gap-3">
          <BrutalButton
            variant="secondary"
            className="bg-accent-secondary text-main border-black"
            onClick={() => setShowCreateModal(true)}
          >
            + Nuevo Proyecto
          </BrutalButton>
          <BrutalButton
            variant="primary"
            className="bg-[#ff005c] text-white border-black"
            onClick={() => setShowTemplateSelector(true)}
          >
            ✨ Usar Plantilla IA
          </BrutalButton>
        </div>
      </header>

      {statusMessage ? (
        <div className="border-4 border-black bg-accent-secondary text-main font-mono px-4 py-3 shadow-brutal">
          {statusMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="border-4 border-black bg-white text-neutral-900 font-mono p-10 text-center shadow-brutal">
          Cargando proyectos...
        </div>
      ) : hasProjects ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {orderedProjects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={confirmDelete} />
          ))}
        </div>
      ) : (
        <div className="border-4 border-black bg-white text-center py-20 px-8 shadow-brutal flex flex-col gap-6">
          <h2 className="text-3xl font-black uppercase tracking-[0.3em] text-black">NO TIENES PROYECTOS</h2>
          <p className="text-neutral-800 font-mono max-w-2xl mx-auto">
            Comienza una nueva revisión sistemática desde cero o deja que Yachay AI proponga un protocolo listo para accionar. Tu panel se poblará automáticamente.
          </p>
        </div>
      )}

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      {showTemplateSelector ? (
        <TemplateSelector
          onClose={() => setShowTemplateSelector(false)}
          onTemplateGenerated={handleTemplateGenerated}
        />
      ) : null}

      {projectPendingDelete ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[10px_10px_0_0_rgba(0,0,0,1)] max-w-lg w-full space-y-4">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-accent-danger">
              ⚠️ Eliminación irreversible
            </p>
            <h3 className="text-3xl font-black uppercase text-main">¿Eliminar este proyecto?</h3>
            <p className="text-sm text-neutral-900 leading-relaxed">
              Vas a borrar <span className="font-bold">{projectPendingDelete.name}</span> y todos sus datos asociados
              (estudios, evaluaciones, narrativa, etc.). Esta acción no se puede deshacer.
            </p>

            <div className="flex flex-col gap-3 md:flex-row">
              <BrutalButton variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </BrutalButton>
              <BrutalButton variant="secondary" className="flex-1" onClick={cancelDelete} disabled={deleting}>
                Cancelar
              </BrutalButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
