import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../pages/Home'
import type { Capability } from '../pages/Capability'

/**
 * The landing is the critical path. Keeping the capability pages — and with them
 * react-hook-form and zod — in a separate chunk stops the 3D experience from
 * paying for a form it never renders.
 */
const CapabilityPage = lazy(() => import('../pages/Capability').then((module) => ({ default: module.CapabilityPage })))
const NotFoundPage = lazy(() => import('../pages/NotFound').then((module) => ({ default: module.NotFoundPage })))

const deferred = (node: ReactNode) => <Suspense fallback={<div className="page-shell" aria-busy="true" />}>{node}</Suspense>
const capability = (id: Capability) => deferred(<CapabilityPage capability={id} />)

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/rendez-vous', element: capability('appointment') },
  { path: '/visiteur', element: capability('visitor') },
  { path: '/visiteur/verification', element: capability('verification') },
  { path: '/reclamation', element: capability('complaint') },
  { path: '/suivi', element: capability('tracking') },
  { path: '/contact', element: capability('contact') },
  { path: '/espace-client', element: capability('client') },
  { path: '*', element: deferred(<NotFoundPage />) },
])
