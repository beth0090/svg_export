import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PathForm from './PathForm.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PathForm />
  </StrictMode>
)
