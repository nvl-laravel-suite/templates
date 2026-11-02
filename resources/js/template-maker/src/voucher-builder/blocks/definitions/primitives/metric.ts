import { Hash } from 'lucide-react'
import { defineBlock } from '../../registry'
import { MetricBlockRenderer } from '../../renderers/primitives/metric-block'
import { contentGroup, styleGroup, typographyGroup } from '../../helpers/settings-factories'
import {
  FONT_SIZE_FIELD_OPTIONS,
  WEIGHT_OPTIONS,
} from '../../primitives/options'

/**
 * Metric keeps its historical field names (`fontSize` + `labelFontSize`,
 * `fontWeight` + `labelFontWeight`, `valueColor` + `textColor`) so that
 * existing persisted projects read cleanly without a schema bump.
 */
export const metricBlock = defineBlock({
  type: 'metric',
  name: 'Metric',
  description: 'Large stat number with label, prefix, and suffix',
  icon: Hash,
  category: 'media',
  allowedIn: ['page', 'column'],
  canContain: false,
  contentOnlyWhenChild: true,

  content: {
    value: { type: 'string', default: '42' },
    label: { type: 'string', default: 'Projects Completed' },
    prefix: { type: 'string', default: '' },
    suffix: { type: 'string', default: '' },
  },
  settings: {
    alignment: { type: 'alignment', default: 'center' },
    fontSize: { type: 'enum', default: 'xl', display: 'pills', options: [...FONT_SIZE_FIELD_OPTIONS] },
    labelFontSize: { type: 'enum', default: 'sm', display: 'pills', options: [...FONT_SIZE_FIELD_OPTIONS] },
    fontWeight: { type: 'enum', default: 'bold', options: [...WEIGHT_OPTIONS] },
    labelFontWeight: { type: 'enum', default: 'normal', options: [...WEIGHT_OPTIONS] },
    valueColor: { type: 'color', default: '' },
    textColor: { type: 'color', default: '' },
  },

  settingsLayout: [
    contentGroup(['value', 'label', 'prefix', 'suffix']),
    styleGroup(['alignment']),
    typographyGroup(['fontSize', 'fontWeight', 'valueColor'], { title: 'Value Style' }),
    typographyGroup(['labelFontSize', 'labelFontWeight', 'textColor'], { title: 'Label Style' }),
  ],

  render: MetricBlockRenderer,
})
