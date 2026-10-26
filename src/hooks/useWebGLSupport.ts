import { useMemo } from 'react'

export function useWebGLSupport() {
  return useMemo(() => {
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', { powerPreference: 'high-performance' })
      const supported = Boolean(context)
      context?.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.width = 0
      canvas.height = 0
      return supported
    } catch {
      return false
    }
  }, [])
}
