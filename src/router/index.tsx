import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../pages/Home'
import { CapabilityPage } from '../pages/Capability'
import { NotFoundPage } from '../pages/NotFound'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/rendez-vous', element: <CapabilityPage capability="appointment" /> },
  { path: '/visiteur', element: <CapabilityPage capability="visitor" /> },
  { path: '/visiteur/verification', element: <CapabilityPage capability="verification" /> },
  { path: '/reclamation', element: <CapabilityPage capability="complaint" /> },
  { path: '/suivi', element: <CapabilityPage capability="tracking" /> },
  { path: '/contact', element: <CapabilityPage capability="contact" /> },
  { path: '/espace-client', element: <CapabilityPage capability="client" /> },
  { path: '*', element: <NotFoundPage /> },
])
