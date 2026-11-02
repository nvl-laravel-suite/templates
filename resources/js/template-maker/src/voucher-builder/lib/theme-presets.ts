export interface ThemePreset {
  id: string
  name: string
  colors: {
    primary: string
    accent: string
    background: string
    text: string
    secondary?: string
    border?: string
    surface?: string
    link?: string
  }
  fonts?: {
    headingFont: string
    bodyFont: string
  }
}

export const themePresets: ThemePreset[] = [
  {
    id: 'professional',
    name: 'Professional',
    colors: { primary: '#111827', accent: '#2563eb', background: '#ffffff', text: '#111827', secondary: '#4b5563', border: '#e5e7eb', surface: '#f9fafb', link: '#2563eb' },
    fonts: { headingFont: 'Inter', bodyFont: 'Inter' },
  },
  {
    id: 'modern',
    name: 'Modern',
    colors: { primary: '#0f172a', accent: '#8b5cf6', background: '#ffffff', text: '#1e293b', secondary: '#64748b', border: '#e2e8f0', surface: '#f8fafc', link: '#7c3aed' },
    fonts: { headingFont: 'Plus Jakarta Sans', bodyFont: 'Inter' },
  },
  {
    id: 'warm',
    name: 'Warm',
    colors: { primary: '#78350f', accent: '#d97706', background: '#fffbeb', text: '#451a03', secondary: '#92400e', border: '#fde68a', surface: '#fef3c7', link: '#b45309' },
    fonts: { headingFont: 'Lora', bodyFont: 'Nunito' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: { primary: '#0c4a6e', accent: '#0891b2', background: '#f0f9ff', text: '#0c4a6e', secondary: '#0e7490', border: '#bae6fd', surface: '#e0f2fe', link: '#0284c7' },
    fonts: { headingFont: 'DM Sans', bodyFont: 'Open Sans' },
  },
  {
    id: 'dark',
    name: 'Dark',
    colors: { primary: '#f8fafc', accent: '#6366f1', background: '#0f172a', text: '#e2e8f0', secondary: '#94a3b8', border: '#334155', surface: '#1e293b', link: '#818cf8' },
    fonts: { headingFont: 'Space Grotesk', bodyFont: 'Inter' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    colors: { primary: '#171717', accent: '#525252', background: '#fafafa', text: '#262626', secondary: '#737373', border: '#e5e5e5', surface: '#f5f5f5', link: '#404040' },
    fonts: { headingFont: 'Inter', bodyFont: 'Inter' },
  },
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    colors: { primary: '#000000', accent: '#000000', background: '#ffffff', text: '#000000', secondary: '#4b5563', border: '#d1d5db', surface: '#f9fafb', link: '#000000' },
    fonts: { headingFont: 'Inter', bodyFont: 'Inter' },
  },
  {
    id: 'executive',
    name: 'Executive',
    colors: { primary: '#1e3a5f', accent: '#c9a961', background: '#ffffff', text: '#1e3a5f', secondary: '#4a6178', border: '#d4d4d8', surface: '#fafaf9', link: '#1e3a5f' },
    fonts: { headingFont: 'Playfair Display', bodyFont: 'Lora' },
  },
  {
    id: 'creative',
    name: 'Creative',
    colors: { primary: '#1e293b', accent: '#f97066', background: '#ffffff', text: '#1e293b', secondary: '#64748b', border: '#e2e8f0', surface: '#f8fafc', link: '#e11d48' },
    fonts: { headingFont: 'Space Grotesk', bodyFont: 'Inter' },
  },
  {
    id: 'academic',
    name: 'Academic',
    colors: { primary: '#14532d', accent: '#0d9488', background: '#ffffff', text: '#14532d', secondary: '#166534', border: '#d1d5db', surface: '#f0fdf4', link: '#0f766e' },
    fonts: { headingFont: 'Merriweather', bodyFont: 'Source Serif 4' },
  },
]
