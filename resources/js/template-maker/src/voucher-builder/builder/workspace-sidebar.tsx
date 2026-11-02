import { ListRadioGroup } from 'themelia-react-ui/base/choice-inputs'
import { Stack } from 'themelia-react-ui/base/structure'
import { Heading, Text } from 'themelia-react-ui/typography'
import { Plus } from 'lucide-react'
import { useEffect, useId } from 'react'
import { useFeature } from '../context'
import { useSectionActions, useSectionState, useSelectionActions } from '../store/hooks'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { PageElements } from './page-elements'
import { BlockLibrary } from './block-library'
import { TemplatePicker } from './template-picker'

export type LibraryTab = 'layers' | 'blocks' | 'templates'

export function WorkspaceSidebar({
  tab,
  onTabChange,
  onInsert,
  onSelectSection,
}: {
  tab: LibraryTab
  onTabChange: (tab: LibraryTab) => void
  onInsert?: () => void
  onSelectSection?: () => void
}) {
  const sectionChoiceName = useId()
  const layers = useFeature('elementsPanel')
  const blocks = useFeature('blockLibrary')
  const templates = useFeature('templates')
  const { sections, activeSectionId } = useSectionState()
  const { setActiveSectionId } = useSectionActions()
  const { clearActiveSelection } = useSelectionActions()
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0]
  const sectionIndex = sections.indexOf(activeSection)
  useEffect(() => {
    const available: LibraryTab[] = [
      ...(layers ? ['layers' as const] : []),
      ...(blocks ? ['blocks' as const] : []),
      ...(templates ? ['templates' as const] : []),
    ]
    if (available.length && !available.includes(tab)) onTabChange(available[0])
  }, [layers, blocks, templates, tab, onTabChange])
  return (
    <Tabs value={tab} onValueChange={(value) => onTabChange(value as LibraryTab)} className="nc-dock-tabs">
      <TabsList variant="line" className="nc-dock-tablist" aria-label="Library panels">
        {layers && <TabsTrigger value="layers">Layers</TabsTrigger>}
        {blocks && <TabsTrigger value="blocks">Blocks</TabsTrigger>}
        {templates && <TabsTrigger value="templates">Templates</TabsTrigger>}
      </TabsList>
      {layers && (
        <TabsContent value="layers" className="nc-dock-scroll">
          <Stack
            gap="md"
            className="nc-section-navigation"
            render={<fieldset aria-label="Document sections" />}
          >
            <legend>
              <Heading tag="h2" size="sm">
                Sections
              </Heading>
            </legend>
            <ListRadioGroup
              name={sectionChoiceName}
              options={sections.map((section, index) => ({
                value: section.id,
                label: `Section ${index + 1}`,
                description: `${section.height} mm · ${section.blockIds.length} ${section.blockIds.length === 1 ? 'block' : 'blocks'}`,
              }))}
              value={activeSection?.id}
              onValueChange={(value) => {
                setActiveSectionId(value)
                clearActiveSelection()
                onSelectSection?.()
              }}
            />
          </Stack>
          {activeSection && (
            <section className="nc-layer-section" aria-label={`Section ${sectionIndex + 1} layers`}>
              <Stack direction="horizontal" align="center" justify="between" gap="sm">
                <Heading tag="h2" size="sm">
                  Section {sectionIndex + 1} layers
                </Heading>
                {blocks && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Add block to Section ${sectionIndex + 1}`}
                    onClick={() => {
                      onTabChange('blocks')
                    }}
                  >
                    <Plus />
                  </Button>
                )}
              </Stack>
              <Text type="secondary">New blocks are added to this section.</Text>
              <PageElements sectionId={activeSection.id} />
            </section>
          )}
          {blocks && (
            <div className="nc-panel-inset">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!activeSectionId) setActiveSectionId(sections[0].id)
                  onTabChange('blocks')
                }}
              >
                <Plus data-icon="inline-start" />
                Add block
              </Button>
            </div>
          )}
        </TabsContent>
      )}
      {blocks && (
        <TabsContent value="blocks" className="nc-dock-scroll nc-panel-inset">
          <BlockLibrary onInsert={onInsert} />
        </TabsContent>
      )}
      {templates && (
        <TabsContent value="templates" className="nc-dock-scroll nc-panel-inset">
          <TemplatePicker />
        </TabsContent>
      )}
    </Tabs>
  )
}
