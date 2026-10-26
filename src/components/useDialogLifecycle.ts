import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type ConcealedElementState = {
  count: number
  inert: boolean
}

const concealedElements = new Map<HTMLElement, ConcealedElementState>()
let pageLockCount = 0
let previousBodyOverflow = ''
let previousDocumentOverflow = ''

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const style = window.getComputedStyle(element)
    return element.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  })
}

function lockPage() {
  if (pageLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.dataset.overlayOpen = 'true'
  }
  pageLockCount += 1
}

function unlockPage() {
  pageLockCount = Math.max(0, pageLockCount - 1)
  if (pageLockCount !== 0) return
  document.body.style.overflow = previousBodyOverflow
  document.documentElement.style.overflow = previousDocumentOverflow
  delete document.documentElement.dataset.overlayOpen
}

function concealBackground() {
  const elements = document.querySelectorAll<HTMLElement>('.skip-link, .system-hud, #main-content')
  elements.forEach((element) => {
    const state = concealedElements.get(element)
    if (state) {
      state.count += 1
      return
    }
    concealedElements.set(element, {
      count: 1,
      inert: element.inert,
    })
    element.inert = true
  })

  return () => {
    elements.forEach((element) => {
      const state = concealedElements.get(element)
      if (!state) return
      state.count -= 1
      if (state.count > 0) return
      element.inert = state.inert
      concealedElements.delete(element)
    })
  }
}

type DialogLifecycleOptions = {
  open: boolean
  dialogRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
}

/**
 * Gives animated overlays the same interaction guarantees as a native modal:
 * page isolation, focus containment, Escape dismissal, and focus restoration.
 */
export function useDialogLifecycle({ open, dialogRef, initialFocusRef, onClose }: DialogLifecycleOptions) {
  const closeHandlerRef = useRef(onClose)
  closeHandlerRef.current = onClose

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusDialog = () => {
      const target = initialFocusRef?.current ?? getFocusableElements(dialog)[0] ?? dialog
      target.focus({ preventScroll: true })
    }
    // Move focus before hiding its former ancestor from assistive technology.
    focusDialog()
    const restoreBackground = concealBackground()
    lockPage()

    const focusFrame = requestAnimationFrame(focusDialog)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeHandlerRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = getFocusableElements(dialog)
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown, true)
      restoreBackground()
      unlockPage()
      if (previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [dialogRef, initialFocusRef, open])
}
