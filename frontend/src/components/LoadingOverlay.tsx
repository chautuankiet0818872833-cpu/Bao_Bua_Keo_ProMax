import React from 'react'
import './LoadingOverlay.css'

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  progress?: string
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message, progress }) => {
  if (!isVisible) return null

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner"></div>
        {message && <p className="loading-message">{message}</p>}
        {progress && <p className="loading-progress">{progress}</p>}
      </div>
    </div>
  )
}

export default LoadingOverlay
