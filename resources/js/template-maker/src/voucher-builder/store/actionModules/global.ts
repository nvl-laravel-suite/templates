import type { DocumentRuntime } from '../runtime'
import type { ComposerActions } from '../types'

export function createGlobalActions(runtime: DocumentRuntime): Pick<
  ComposerActions,
  | 'updateGlobal'
  | 'updateLayout'
  | 'updateColors'
  | 'updateTypography'
  | 'updateMetadata'
  | 'updateFrame'
  | 'setShowRulers'
  | 'setShowGrid'
  | 'setGridSize'
  | 'setSnapToGrid'
  | 'setDebugMode'
  | 'setShowPreviewData'
  | 'setZoomLevel'
  | 'setZoomMode'
> {
  const { updateProjectState } = runtime
  const emitAction = runtime.events.emit
  return {
    updateGlobal: (updates) => {
      updateProjectState((state) => ({ global: { ...state.global, ...updates } }))
      emitAction({ type: 'global.update', patch: updates as Record<string, unknown> })
    },

    updateLayout: (layout) => {
      updateProjectState((state) => ({ global: { ...state.global, layout: { ...state.global.layout, ...layout } } }))
      emitAction({ type: 'global.update', patch: { layout } })
    },

    updateColors: (colors) => {
      updateProjectState((state) => ({ global: { ...state.global, colors: { ...state.global.colors, ...colors } } }))
      emitAction({ type: 'global.update', patch: { colors } })
    },

    updateTypography: (typography) => {
      updateProjectState((state) => ({ global: { ...state.global, typography: { ...state.global.typography, ...typography } } }))
      emitAction({ type: 'global.update', patch: { typography } })
    },

    updateMetadata: (metadata) => {
      updateProjectState((state) => ({ global: { ...state.global, metadata: { ...state.global.metadata, ...metadata } } }))
      emitAction({ type: 'global.update', patch: { metadata } })
    },

    updateFrame: (frame) => {
      updateProjectState((state) => ({ frame: { ...state.frame, ...frame } }))
      emitAction({ type: 'frame.update', patch: frame as Record<string, unknown> })
    },

    setShowRulers: (show) => {
      runtime.editor.setState({ showRulers: show })
    },

    setShowGrid: (show) => {
      runtime.editor.setState({ showGrid: show })
    },

    setGridSize: (size) => {
      runtime.editor.setState({ gridSize: size })
    },

    setSnapToGrid: (snap) => {
      runtime.editor.setState({ snapToGrid: snap })
    },

    setDebugMode: (debug) => {
      runtime.editor.setState({ debugMode: debug })
    },

    setShowPreviewData: (show) => {
      runtime.editor.setState({ showPreviewData: show })
    },

    setZoomLevel: (level) => {
      runtime.editor.setState({ zoomLevel: level })
    },

    setZoomMode: (mode) => {
      runtime.editor.setState({ zoomMode: mode })
    },
  }
}
