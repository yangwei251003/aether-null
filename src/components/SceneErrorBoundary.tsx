import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback: ReactNode; onError?: () => void }
type State = { failed: boolean }

export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Spatial archive entered designed fallback mode.', error.message, info.componentStack)
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
