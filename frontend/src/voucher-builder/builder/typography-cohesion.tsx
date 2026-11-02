import { Text } from 'themelia-react-ui/typography'
import { Card } from 'themelia-react-ui/base/cards'
import { Badge } from 'themelia-react-ui/base/badge'
import { Alert, AlertTitle, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Stack as UIStack } from 'themelia-react-ui/base/structure'
import { Button as UIAction } from 'themelia-react-ui/base/buttons'
import { useEffect, useMemo, useState } from 'react'
import {
  useBlockActions,
  useDocumentState,
  useHistoryActions,
  useSelectionActions,
} from '#/voucher-builder/store/hooks'
import {
  analyzeTypography,
  buildNormalizationPatches,
  formatAttrValue,
  TYPOGRAPHY_ATTR_LABELS,
  type AttributeVariance,
  type CrossFamilyHint,
  type FamilyReport,
} from '#/voucher-builder/lib/typography-audit'
import { labelOf } from '#/voucher-builder/blocks'
import type { Block } from '#/voucher-builder/schema'
import { getBlockSettings } from '#/voucher-builder/blocks/settings-accessor'
import { Focus, Pencil, Wand2 } from 'lucide-react'
import { useToast } from '#/voucher-builder/hooks/use-toast'

export function TypographyCohesionSection() {
  const toast = useToast()

  const global = useDocumentState((state) => state.global)
  const blocks = useDocumentState((state) => state.blocks)
  const sections = useDocumentState((state) => state.sections)
  const columnBlocks = useDocumentState((state) => state.columnBlocks)
  const frame = useDocumentState((state) => state.frame)
  const { updateBlock } = useBlockActions()
  const { pushHistory } = useHistoryActions()
  const { setActiveBlock, setFocusedBlocks, clearFocusedBlocks } = useSelectionActions()

  const project = useMemo(
    () => ({ global, blocks, sections, columnBlocks, frame }),
    [global, blocks, sections, columnBlocks, frame],
  )
  const report = useMemo(() => analyzeTypography(project), [project])

  // Clear any residual focus outline when this panel unmounts.
  useEffect(
    () => () => {
      clearFocusedBlocks()
    },
    [clearFocusedBlocks],
  )

  if (report.families.length === 0 && report.crossFamily.length === 0) {
    return (
      <Alert tone="success">
        <AlertTitle>Typography is consistent</AlertTitle>
        <AlertDescription>Every block type uses matching font settings across the voucher.</AlertDescription>
      </Alert>
    )
  }

  const handleNormalize = (family: FamilyReport, variance: AttributeVariance, value: string) => {
    const patches = buildNormalizationPatches(project, family.family, variance.attr, value)
    if (patches.length === 0) return
    pushHistory()
    for (const { blockId, patch } of patches) {
      const block = blocks[blockId]
      if (!block) continue
      updateBlock(blockId, { settings: { ...getBlockSettings(block), ...patch } } as never)
    }
    const attrName = TYPOGRAPHY_ATTR_LABELS[variance.attr].toLowerCase()
    const count = patches.length
    toast(`Normalized ${attrName} on ${count} ${count === 1 ? 'block' : 'blocks'} — ⌘Z to undo`, 'success')
  }

  // ── Focus API (visual-only) vs. Jump API (mutates selection + opens panel) ──
  //
  // Every interaction in this panel uses `setFocusedBlocks` to paint an
  // amber outline on the canvas WITHOUT changing the active selection. That
  // keeps the typography panel visible while the user inspects blocks.
  //
  // The explicit pencil icon next to a block name jumps the right panel over
  // to Block settings (via setActiveBlock).
  const focus = (ids: string[]) => setFocusedBlocks(ids)
  const clearFocus = () => clearFocusedBlocks()
  const jumpToBlock = (id: string) => {
    clearFocusedBlocks()
    setActiveBlock(id)
  }

  return (
    <Card
      surface="flat"
      padding="none"
      title="Typography cohesion"
      titleSuffix={<Badge>{report.totalVariances} variances</Badge>}
      contentGap="2xl"
    >
      {report.families.map((family) => (
        <FamilyCard
          key={family.family}
          family={family}
          blocks={blocks}
          onNormalize={(variance, value) => handleNormalize(family, variance, value)}
          onFocus={focus}
          onClearFocus={clearFocus}
          onJumpToBlock={jumpToBlock}
        />
      ))}
      {report.crossFamily.length > 0 && <CrossFamilySection hints={report.crossFamily} />}
    </Card>
  )
}

function CrossFamilySection({ hints }: { hints: CrossFamilyHint[] }) {
  return (
    <Card
      surface="flat"
      padding="none"
      title="Across families"
      description="These families are internally consistent but use different settings. Align them when the document calls for shared typography."
      contentGap="lg"
    >
      {hints.map((hint) => (
        <UIStack key={hint.attr} gap="sm">
          <Text weight="medium">{TYPOGRAPHY_ATTR_LABELS[hint.attr]}</Text>
          {hint.families.map(({ family, familyLabel, value }) => (
            <Text key={family} type="secondary">
              {familyLabel}: {formatAttrValue(hint.attr, value)}
            </Text>
          ))}
        </UIStack>
      ))}
    </Card>
  )
}
interface FamilyCardProps {
  family: FamilyReport
  blocks: Record<string, Block>
  onNormalize: (variance: AttributeVariance, value: string) => void
  onFocus: (ids: string[]) => void
  onClearFocus: () => void
  onJumpToBlock: (id: string) => void
}
function FamilyCard({ family, blocks, onNormalize, onFocus, onClearFocus, onJumpToBlock }: FamilyCardProps) {
  return (
    <Card
      surface="flat"
      padding="none"
      title={family.familyLabel}
      titleSuffix={<Badge>{family.blockIds.length} blocks</Badge>}
      headerAction={
        <UIAction
          iconOnly
          buttonStyle="ghost"
          aria-label={`Outline ${family.familyLabel}`}
          withTooltip={`Outline ${family.familyLabel}`}
          onClick={() => onFocus(family.blockIds)}
          onMouseEnter={() => onFocus(family.blockIds)}
          onMouseLeave={onClearFocus}
        >
          <Focus />
        </UIAction>
      }
      contentGap="lg"
    >
      {family.variances.map((variance) => (
        <VarianceRow
          key={variance.attr}
          variance={variance}
          blocks={blocks}
          onNormalize={(value) => onNormalize(variance, value)}
          onFocus={onFocus}
          onClearFocus={onClearFocus}
          onJumpToBlock={onJumpToBlock}
        />
      ))}
    </Card>
  )
}
interface VarianceRowProps {
  variance: AttributeVariance
  blocks: Record<string, Block>
  onNormalize: (value: string) => void
  onFocus: (ids: string[]) => void
  onClearFocus: () => void
  onJumpToBlock: (id: string) => void
}
function VarianceRow({
  variance,
  blocks,
  onNormalize,
  onFocus,
  onClearFocus,
  onJumpToBlock,
}: VarianceRowProps) {
  const { attr, values, majority } = variance
  const [openValue, setOpenValue] = useState<string | null>(null)
  return (
    <Card
      surface="card"
      title={TYPOGRAPHY_ATTR_LABELS[attr]}
      description={`${values.length} variants`}
      headerAction={
        <UIAction
          iconOnly
          buttonStyle="ghost"
          aria-label={`Normalize ${TYPOGRAPHY_ATTR_LABELS[attr]}`}
          withTooltip={`Apply ${formatAttrValue(attr, majority)} to all`}
          onClick={() => onNormalize(majority)}
        >
          <Wand2 />
        </UIAction>
      }
      contentGap="lg"
    >
      {values.map(({ value, count, blockIds }) => (
        <UIStack key={value} gap="md">
          <UIStack direction="horizontal" align="center" justify="between" gap="sm" wrap={false}>
            <UIAction
              buttonStyle="ghost"
              aria-pressed={openValue === value}
              onClick={() => {
                onFocus(blockIds)
                setOpenValue(openValue === value ? null : value)
              }}
              onMouseEnter={() => onFocus(blockIds)}
              onMouseLeave={onClearFocus}
            >
              {attr === 'textColor' && value && (
                <span className="nc-color-sample" aria-hidden style={{ backgroundColor: value }} />
              )}
              {formatAttrValue(attr, value)}
            </UIAction>
            <Badge>
              {count}
              {value === majority ? ' · common' : ''}
            </Badge>
            <UIAction
              iconOnly
              buttonStyle="ghost"
              aria-label={`Apply ${formatAttrValue(attr, value)} to all`}
              withTooltip="Apply to all"
              onClick={() => onNormalize(value)}
            >
              <Wand2 />
            </UIAction>
          </UIStack>
          {openValue === value && (
            <UIStack gap="sm">
              {blockIds.map((id) => {
                const block = blocks[id]
                if (!block) return null
                const label = labelOf(block)
                return (
                  <UIStack
                    key={id}
                    direction="horizontal"
                    align="center"
                    justify="between"
                    gap="sm"
                    onMouseEnter={() => onFocus([id])}
                    onMouseLeave={onClearFocus}
                  >
                    <Text type="secondary">{label}</Text>
                    <UIAction
                      iconOnly
                      buttonStyle="ghost"
                      aria-label={`Edit ${label}`}
                      onClick={() => onJumpToBlock(id)}
                    >
                      <Pencil />
                    </UIAction>
                  </UIStack>
                )
              })}
            </UIStack>
          )}
        </UIStack>
      ))}
    </Card>
  )
}
