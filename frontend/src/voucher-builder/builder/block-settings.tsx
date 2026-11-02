import { EmptyState } from 'themelia-react-ui/blocks/data-display'
import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import {
  useBlockActions,
  useDocumentState,
  useHistoryActions,
  useSelectionState,
} from '#/voucher-builder/store/hooks'
import type { Block, CommonBlockSettings } from '#/voucher-builder/schema'
import { defaultCommonSettings } from '#/voucher-builder/schema'
import { getBlockDef, isComposableType } from '#/voucher-builder/blocks'
import { getBlockSettings } from '#/voucher-builder/blocks/settings-accessor'
import { getParentContext } from '#/voucher-builder/engine/graph'
import '#/voucher-builder/blocks/definitions'
import { AutoSettingsRenderer } from './auto-settings-renderer'
import { SettingsPanel } from '#/voucher-builder/builder/settings/settings-panel'
import { ScopeRenderer } from '#/voucher-builder/builder/settings/scopes/scope-renderer'
import { DEFAULT_SCOPE_IDS, getScope } from '#/voucher-builder/builder/settings/scopes'
import { customOverrides } from '#/voucher-builder/builder/settings/overrides'
import { SettingBlock } from './settings/primitives/setting-block'
import { ADVANCED_SCOPE_IDS, type InspectorTab } from '../lib/inspector'

// ── Legacy container-group → scope-id mapping ─────────────────
const LEGACY_CONTAINER_TO_SCOPES: Record<string, string[]> = {
  spacing: ['spacing'],
  surface: ['surface'],
  border: ['border-shape', 'effects'],
}

function resolveScopeIds(definition: ReturnType<typeof getBlockDef>): readonly string[] {
  if (!definition) return DEFAULT_SCOPE_IDS
  if (definition.scopes) return definition.scopes
  if (definition.containerGroups) {
    const allowed = new Set(definition.containerGroups.flatMap((g) => LEGACY_CONTAINER_TO_SCOPES[g] ?? []))
    return DEFAULT_SCOPE_IDS.filter(
      (id) => allowed.has(id) || id === 'dynamic' || id === 'visibility' || id === 'layout',
    )
  }
  return DEFAULT_SCOPE_IDS
}

function findComposableParent(
  blockId: string,
  blocks: Record<string, Block>,
  columnBlocks: Record<string, string[]>,
) {
  const parent = getParentContext({ blocks, sections: [] as any, columnBlocks }, blockId)
  if (parent?.kind !== 'container') return null
  if (!blocks[parent.parentId] || !isComposableType(blocks[parent.parentId].type)) return null
  return { parentId: parent.parentId, index: parent.index }
}

export function BlockSettings({ tab = 'content' }: { tab?: InspectorTab }) {
  const { activeBlockId, activeBlockIds } = useSelectionState()
  const blocks = useDocumentState((state) => state.blocks)
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const { updateBlock, updateBlockCommonSettings, updateBlockCommonSettingsMany } = useBlockActions()
  const { pushHistory } = useHistoryActions()

  const selectedBlocks = activeBlockIds.map((id) => blocks[id]).filter(Boolean)
  const isMixedSelection = selectedBlocks.length > 1

  if (selectedBlocks.length === 0 || !activeBlockId || !blocks[activeBlockId]) {
    return (
      <EmptyState
        className="h-full"
        title="Select a block"
        description="Choose a block on the canvas to edit its settings."
      />
    )
  }

  const block = blocks[activeBlockId]
  const definition = getBlockDef(block.type)
  const commonSettings = block.commonSettings || defaultCommonSettings
  const composableParent = findComposableParent(activeBlockId, blocks, columnBlocks)
  const CustomOverride = customOverrides[block.type]

  const patchCommonLive = (patch: Partial<CommonBlockSettings>) => {
    if (isMixedSelection) {
      updateBlockCommonSettingsMany(activeBlockIds, patch)
    } else {
      updateBlockCommonSettings(activeBlockId, patch)
    }
  }

  const onScopeChangeStart = () => pushHistory()

  const update = (updates: Partial<Block>) => {
    pushHistory()
    updateBlock(activeBlockId, updates)
  }

  const onContentChange = (key: string, value: unknown) => {
    pushHistory()
    updateBlock(activeBlockId, { content: { ...block.content, [key]: value } } as Partial<Block>)
  }
  const onContentLiveChange = (key: string, value: unknown) => {
    updateBlock(activeBlockId, { content: { ...block.content, [key]: value } } as Partial<Block>)
  }
  const onContentChangeStart = () => pushHistory()

  const onSettingsChange = (key: string, value: unknown) => {
    pushHistory()
    updateBlock(activeBlockId, { settings: { ...getBlockSettings(block), [key]: value } } as Partial<Block>)
  }
  const onSettingsLiveChange = (key: string, value: unknown) => {
    updateBlock(activeBlockId, { settings: { ...getBlockSettings(block), [key]: value } } as Partial<Block>)
  }
  const onSettingsChangeStart = () => pushHistory()

  const scopeIds = resolveScopeIds(definition)
  const scopeOverrides = definition?.scopeOverrides ?? {}
  const mixedSettings = selectedBlocks[0]?.commonSettings || defaultCommonSettings

  if (isMixedSelection) {
    return (
      <SettingsPanel
        label="Mixed Selection"
        badges={[`${selectedBlocks.length} selected`]}
        description="Container settings apply to all selected blocks."
      >
        <Alert>
          <AlertDescription>
            Block-specific content and style controls are hidden for mixed selections.
          </AlertDescription>
        </Alert>
        {DEFAULT_SCOPE_IDS.filter((id) =>
          tab === 'data' ? id === 'dynamic' : tab === 'style' && id !== 'dynamic',
        ).map((id) => {
          const scope = getScope(id)
          if (!scope || scope.source !== 'common') return null
          return (
            <ScopeRenderer
              key={id}
              scope={scope}
              row={mixedSettings}
              onPatch={(patch) => patchCommonLive(patch as Partial<CommonBlockSettings>)}
              onChangeStart={onScopeChangeStart}
            />
          )
        })}
      </SettingsPanel>
    )
  }

  return (
    <SettingsPanel label={definition?.name || block.type} hideHeader description={definition?.description}>
      {CustomOverride && tab === 'content' && <CustomOverride block={block} update={update} />}

      {definition && (
        <AutoSettingsRenderer
          def={definition}
          content={block.content}
          settings={getBlockSettings(block)}
          onContentChange={onContentChange}
          onContentLiveChange={onContentLiveChange}
          onContentChangeStart={onContentChangeStart}
          onSettingsChange={onSettingsChange}
          onSettingsLiveChange={onSettingsLiveChange}
          onSettingsChangeStart={onSettingsChangeStart}
          contentOnly={!!composableParent && !!definition.contentOnlyWhenChild}
          tab={tab}
        />
      )}

      {scopeIds
        .filter(
          (id) =>
            !ADVANCED_SCOPE_IDS.has(id) &&
            (tab === 'data' ? id === 'dynamic' : tab === 'style' && id !== 'dynamic'),
        )
        .map((id) => {
          const scope = getScope(id)
          if (!scope) return null
          if (scope.source !== 'common') return null
          return (
            <ScopeRenderer
              key={id}
              scope={scope}
              row={commonSettings}
              onPatch={(patch) => patchCommonLive(patch as Partial<CommonBlockSettings>)}
              onChangeStart={onScopeChangeStart}
              override={{ ...scopeOverrides[id], defaultOpen: tab === 'data' }}
            />
          )
        })}
      {tab === 'style' && (
        <SettingBlock label="Advanced" defaultOpen={false}>
          {scopeIds
            .filter((id) => ADVANCED_SCOPE_IDS.has(id))
            .map((id) => {
              const scope = getScope(id)
              return scope ? (
                <ScopeRenderer
                  key={id}
                  scope={scope}
                  row={commonSettings}
                  onPatch={(patch) => patchCommonLive(patch as Partial<CommonBlockSettings>)}
                  onChangeStart={onScopeChangeStart}
                  override={{ ...scopeOverrides[id], defaultOpen: false }}
                />
              ) : null
            })}
        </SettingBlock>
      )}
    </SettingsPanel>
  )
}
