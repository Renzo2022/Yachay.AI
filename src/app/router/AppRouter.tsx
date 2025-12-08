import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '../../core/layouts/AppLayout'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { DashboardView } from '../../features/projects/views/DashboardView'
import { ProjectLayout } from '../../features/projects/layouts/ProjectLayout'
import { Phase1View } from '../../features/phase1_planning/views/Phase1View'
import { Phase2View } from '../../features/phase2_search/views/Phase2View'
import { Phase3View } from '../../features/phase3_screening/views/Phase3View'
import { Phase4View } from '../../features/phase4_quality/views/Phase4View'
import { Phase5View } from '../../features/phase5_extraction/views/Phase5View'
import { Phase6View } from '../../features/phase6_synthesis/views/Phase6View'
import { Phase7View } from '../../features/phase7_report/views/Phase7View'
import { LandingGate } from '../../features/landing/LandingGate'

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingGate />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardView />} />
        </Route>
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route index element={<Navigate to="phase1" replace />} />
          <Route path="phase1" element={<Phase1View />} />
          <Route path="phase2" element={<Phase2View />} />
          <Route path="phase3" element={<Phase3View />} />
          <Route path="phase4" element={<Phase4View />} />
          <Route path="phase5" element={<Phase5View />} />
          <Route path="phase6" element={<Phase6View />} />
          <Route path="phase7" element={<Phase7View />} />
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
)
