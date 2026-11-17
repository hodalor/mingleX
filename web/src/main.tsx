import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { matchPolicyPath, PolicyShell } from './policyPages.tsx'
import { Toaster } from './toast.tsx'

const policy = matchPolicyPath(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {policy ? <PolicyShell page={policy} /> : <App />}
    <Toaster />
  </StrictMode>,
)
