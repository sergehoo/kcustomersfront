import { lazy, Suspense } from 'react'

const CustomerCareExperience = lazy(() => import('../experience/CustomerCareExperience').then((module) => ({ default: module.CustomerCareExperience })))

export function HomePage() { return <Suspense fallback={<div className="experience-loader" role="status"><img className="kd-brand-logo" src="/brand/kaydan-groupe-light.svg" alt="Kaydan Groupe" width={582} height={228} /><i /><small>MYKAYDAN…</small></div>}><CustomerCareExperience /></Suspense> }
