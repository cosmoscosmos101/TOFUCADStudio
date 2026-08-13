import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Homepage from './pages/Homepage'
import Projects from './pages/Projects'
import Studio from './pages/Studio'
import { useAuthStore } from './hooks/useAuthStore'
import './styles/globals.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return children
}

function AppInit({ children }) {
  const fetchMe = useAuthStore(s => s.fetchMe)
  useEffect(() => { fetchMe() }, [])
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Homepage />} />
        <Route path="/projects" element={
          <ProtectedRoute><Projects /></ProtectedRoute>
        } />
        <Route path="/studio" element={
          <ProtectedRoute><Studio /></ProtectedRoute>
        } />
        <Route path="/studio/:projectId" element={
          <ProtectedRoute><Studio /></ProtectedRoute>
        } />
      </Routes>
    </AnimatePresence>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppInit>
        <AnimatedRoutes />
      </AppInit>
    </BrowserRouter>
  </React.StrictMode>
)
