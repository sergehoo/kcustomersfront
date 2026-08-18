import { lazy, Suspense } from 'react'

const CustomerCareExperience = lazy(() => import('../experience/CustomerCareExperience').then((module) => ({ default: module.CustomerCareExperience })))

export function HomePage() { return <Suspense fallback={<div className="experience-loader" role="status"><span>KAYDAN</span><i /><small>ENTRÉE…</small></div>}><CustomerCareExperience /></Suspense> }
