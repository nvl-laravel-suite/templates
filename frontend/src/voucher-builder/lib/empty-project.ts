/**
 * Pure (no zustand, no localStorage) factory for an empty Project.
 * Imported by both the editor store and the headless render API so the
 * latter can be loaded outside the browser.
 */

import type { GlobalSettings } from '#/voucher-builder/schema'
import { SECTION_IDS, DEFAULT_SECTION_HEIGHTS } from '#/voucher-builder/lib/voucher'
import type { DocumentStoreState } from '#/voucher-builder/store/types'

export const defaultGlobal: GlobalSettings = {
  layout: {
    pagePadding: 0,
    margin: 10,
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseSize: 16,
    lineHeight: 1.5,
    headingLineHeight: 1.2,
    paragraphSpacing: 0,
    headingSpacing: 0,
  },
  colors: {
    primary: '#111827',
    accent: '#3b82f6',
    background: '#ffffff',
    text: '#111827',
    secondary: '#6b7280',
    border: '#e5e7eb',
    surface: '#f9fafb',
    link: '#2563eb',
  },
  metadata: {
    title: 'Untitled Voucher',
    author: '',
    subject: undefined,
    keywords: [],
    language: 'en',
  },
  previewData: {},
}

export function createEmptyProject(): DocumentStoreState {
  return {
    global: structuredClone(defaultGlobal),
    blocks: {},
    sections: [
      { id: SECTION_IDS[0], height: DEFAULT_SECTION_HEIGHTS[0], padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
      { id: SECTION_IDS[1], height: DEFAULT_SECTION_HEIGHTS[1], padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
      { id: SECTION_IDS[2], height: DEFAULT_SECTION_HEIGHTS[2], padding: 4, backgroundColor: '#ffffff', backgroundOpacity: 1, widthMode: 'wide', verticalAlign: 'center', blockIds: [] },
    ],
    columnBlocks: {},
    frame: { imageUrl: null, opacity: 1 },
  }
}
