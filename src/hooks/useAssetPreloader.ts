import { useEffect, useState } from 'react'

const criticalAssets = [`${import.meta.env.BASE_URL}assets/images/memory-ocean.webp`]
const PRELOAD_TIMEOUT_MS = 10_000

const loadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Unable to load ${src}`))
    image.src = src
  })

export function useAssetPreloader(loadSpatialScene = true) {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const tasks: Promise<unknown>[] = [
      document.fonts.ready,
      ...criticalAssets.map(loadImage),
    ]
    if (loadSpatialScene) tasks.push(import('../scene/SceneCanvas'))
    let completed = 0
    let finalized = false
    const timeout = window.setTimeout(() => {
      if (!active) return
      finalized = true
      setError('Spatial preload timed out; entering resilient fallback mode')
      setProgress(100)
      setReady(true)
    }, PRELOAD_TIMEOUT_MS)

    tasks.forEach((task) => {
      Promise.resolve(task)
        .catch((reason: unknown) => {
          if (active && !finalized) setError(reason instanceof Error ? reason.message : 'Archive resource unavailable')
        })
        .finally(() => {
          completed += 1
          if (!active || finalized) return
          setProgress(Math.round((completed / tasks.length) * 100))
          if (completed === tasks.length) {
            finalized = true
            window.clearTimeout(timeout)
            setReady(true)
          }
        })
    })

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [loadSpatialScene])

  return { progress, ready, error }
}
