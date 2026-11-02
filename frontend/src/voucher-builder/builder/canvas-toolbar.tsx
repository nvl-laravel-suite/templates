import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
import { ChevronDown, Minus, Plus, Undo2, Redo2, SlidersHorizontal, Eye } from 'lucide-react'
import { useFeature, useReadOnly } from '../context'
import {
  useHistoryActions,
  useHistoryState,
  useVisualToolingActions,
  useVisualToolingState,
} from '../store/hooks'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'

interface CanvasToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onFitWidth: () => void
  onFitPage: () => void
  onOpenInspector?: () => void
}

export function CanvasToolbar({
  zoom,
  onZoomChange,
  onFitWidth,
  onFitPage,
  onOpenInspector,
}: CanvasToolbarProps) {
  const readOnly = useReadOnly()
  const debug = useFeature('debugTools') && !readOnly
  const previewData = useFeature('previewData') && !readOnly
  const history = useFeature('undoRedo')
  const { undo, redo } = useHistoryActions()
  const { undoStack, redoStack } = useHistoryState()
  const state = useVisualToolingState()
  const actions = useVisualToolingActions()
  return (
    <UIStack
      direction="horizontal"
      align="center"
      justify="between"
      gap="sm"
      wrap={false}
      className="nc-canvas-toolbar"
      role="toolbar"
      aria-label="Canvas view controls"
    >
      <UIStack direction="horizontal" gap="xs" align="center" wrap={false} className="min-w-0">
        {history && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Undo"
              title="Undo"
              disabled={!undoStack.length}
              onClick={undo}
            >
              <Undo2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Redo"
              title="Redo"
              disabled={!redoStack.length}
              onClick={redo}
            >
              <Redo2 />
            </Button>
            <span className="nc-toolbar-divider" />
          </>
        )}
        {(debug || previewData) && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" aria-label="View options" />}>
              <Eye className="nc-view-icon" />
              <span className="nc-view-label">View</span>
              <ChevronDown className="nc-view-chevron" data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuGroup>
                {debug && (
                  <>
                    <DropdownMenuCheckboxItem
                      checked={state.showRulers}
                      onCheckedChange={actions.setShowRulers}
                    >
                      Rulers
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked={state.showGrid} onCheckedChange={actions.setShowGrid}>
                      Grid
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={state.snapToGrid}
                      onCheckedChange={actions.setSnapToGrid}
                    >
                      Snap to grid
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={state.debugMode}
                      onCheckedChange={actions.setDebugMode}
                    >
                      Section guides
                    </DropdownMenuCheckboxItem>
                  </>
                )}
                {previewData && (
                  <DropdownMenuCheckboxItem
                    checked={state.showPreviewData}
                    onCheckedChange={actions.setShowPreviewData}
                  >
                    Use sample data
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </UIStack>
      <UIStack direction="horizontal" gap="xs" align="center" wrap={false} className="shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom out"
          disabled={zoom <= 10}
          onClick={() => onZoomChange(Math.max(10, zoom - 5))}
        >
          <Minus />
        </Button>
        <Text tag="span" size="xs" type="secondary" className="nc-zoom-value" aria-live="polite">
          {zoom}%
        </Text>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom in"
          disabled={zoom >= 200}
          onClick={() => onZoomChange(Math.min(200, zoom + 5))}
        >
          <Plus />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" />}>
            Fit
            <ChevronDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onFitWidth}>Fit width</DropdownMenuItem>
              <DropdownMenuItem onClick={onFitPage}>Fit page</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onZoomChange(100)}>Actual size · 100%</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {onOpenInspector && (
          <Button variant="ghost" size="icon" aria-label="Open inspector" onClick={onOpenInspector}>
            <SlidersHorizontal />
          </Button>
        )}
      </UIStack>
    </UIStack>
  )
}
