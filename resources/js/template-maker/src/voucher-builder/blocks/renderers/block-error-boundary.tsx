import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  blockType: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>{this.props.blockType}</strong> failed to render.
            {this.state.error?.message && (
              <span className="opacity-70 ml-1">({this.state.error.message})</span>
            )}
          </span>
        </div>
      )
    }
    return this.props.children
  }
}
