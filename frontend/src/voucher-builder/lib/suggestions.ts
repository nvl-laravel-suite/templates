export interface SuggestionChip {
  label: string
  value: string
}

const timelineDescriptionSuggestions: SuggestionChip[] = [
  { label: 'Metric-driven', value: 'Drove [initiative] that improved [metric] by [result] across [team/product].' },
  { label: 'Leadership', value: 'Led cross-functional delivery of [project], coordinating [teams] and shipping [outcome] on schedule.' },
  { label: 'Process', value: 'Streamlined [workflow] by introducing [system/tool], reducing [pain point] and improving reliability.' },
  { label: 'Impact', value: 'Owned [scope] from planning through launch, resulting in [business outcome] and stronger stakeholder confidence.' },
]

const projectDescriptionSuggestions: SuggestionChip[] = [
  { label: 'Problem / Solution', value: 'Built [project] to solve [problem], using [approach] to deliver [outcome].' },
  { label: 'Scale', value: 'Designed and shipped [feature/system] used by [audience], improving [metric] and reducing [constraint].' },
  { label: 'Technical depth', value: 'Implemented [architecture/pattern] with [stack], balancing [tradeoff] and [tradeoff].' },
  { label: 'Portfolio angle', value: 'Focused on [experience goal], pairing [design/engineering decision] with measurable product results.' },
]

export function getFieldSuggestions(blockType: string, fieldKey: string): SuggestionChip[] {
  if (fieldKey !== 'description') return []
  if (blockType === 'timelineEntry') return timelineDescriptionSuggestions
  if (blockType === 'projectEntry') return projectDescriptionSuggestions
  return []
}
