import {
  Briefcase, GraduationCap, Award, Star, Heart, Lightbulb, Code,
  Phone, Mail, User, Folder, Globe, Zap, Target, Trophy,
  Building2, Calendar, MapPin, Linkedin, Github, Twitter,
  ExternalLink, FileText, BookOpen, Pen, Wrench, Settings,
  Shield, Lock, Key, Database, Server, Cloud, Wifi,
  Monitor, Cpu, Smartphone, Palette, Camera, Music,
  Headphones, Mic, Video, Gamepad2, Rocket, Flag,
  Clock, TrendingUp, BarChart3, PieChart, DollarSign,
  type LucideIcon,
} from 'lucide-react'

export interface IconEntry {
  key: string
  label: string
  icon: LucideIcon
  category: string
}

export const iconRegistry: IconEntry[] = [
  // Business
  { key: 'briefcase', label: 'Briefcase', icon: Briefcase, category: 'Business' },
  { key: 'building2', label: 'Building', icon: Building2, category: 'Business' },
  { key: 'dollarSign', label: 'Dollar', icon: DollarSign, category: 'Business' },
  { key: 'trendingUp', label: 'Trending Up', icon: TrendingUp, category: 'Business' },
  { key: 'barChart3', label: 'Bar Chart', icon: BarChart3, category: 'Business' },
  { key: 'pieChart', label: 'Pie Chart', icon: PieChart, category: 'Business' },
  { key: 'target', label: 'Target', icon: Target, category: 'Business' },

  // Education
  { key: 'graduationCap', label: 'Education', icon: GraduationCap, category: 'Education' },
  { key: 'bookOpen', label: 'Book', icon: BookOpen, category: 'Education' },
  { key: 'pen', label: 'Pen', icon: Pen, category: 'Education' },
  { key: 'fileText', label: 'Document', icon: FileText, category: 'Education' },

  // Tech
  { key: 'code', label: 'Code', icon: Code, category: 'Tech' },
  { key: 'database', label: 'Database', icon: Database, category: 'Tech' },
  { key: 'server', label: 'Server', icon: Server, category: 'Tech' },
  { key: 'cloud', label: 'Cloud', icon: Cloud, category: 'Tech' },
  { key: 'wifi', label: 'Wifi', icon: Wifi, category: 'Tech' },
  { key: 'monitor', label: 'Monitor', icon: Monitor, category: 'Tech' },
  { key: 'cpu', label: 'CPU', icon: Cpu, category: 'Tech' },
  { key: 'smartphone', label: 'Smartphone', icon: Smartphone, category: 'Tech' },
  { key: 'settings', label: 'Settings', icon: Settings, category: 'Tech' },
  { key: 'wrench', label: 'Wrench', icon: Wrench, category: 'Tech' },

  // Communication
  { key: 'phone', label: 'Phone', icon: Phone, category: 'Communication' },
  { key: 'mail', label: 'Mail', icon: Mail, category: 'Communication' },
  { key: 'globe', label: 'Globe', icon: Globe, category: 'Communication' },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, category: 'Communication' },
  { key: 'github', label: 'GitHub', icon: Github, category: 'Communication' },
  { key: 'twitter', label: 'Twitter', icon: Twitter, category: 'Communication' },
  { key: 'externalLink', label: 'Link', icon: ExternalLink, category: 'Communication' },

  // Achievement
  { key: 'award', label: 'Award', icon: Award, category: 'Achievement' },
  { key: 'trophy', label: 'Trophy', icon: Trophy, category: 'Achievement' },
  { key: 'star', label: 'Star', icon: Star, category: 'Achievement' },
  { key: 'flag', label: 'Flag', icon: Flag, category: 'Achievement' },
  { key: 'rocket', label: 'Rocket', icon: Rocket, category: 'Achievement' },
  { key: 'zap', label: 'Zap', icon: Zap, category: 'Achievement' },
  { key: 'shield', label: 'Shield', icon: Shield, category: 'Achievement' },

  // People
  { key: 'user', label: 'User', icon: User, category: 'People' },

  // Places & Time
  { key: 'mapPin', label: 'Location', icon: MapPin, category: 'Places' },
  { key: 'calendar', label: 'Calendar', icon: Calendar, category: 'Places' },
  { key: 'clock', label: 'Clock', icon: Clock, category: 'Places' },

  // Creative
  { key: 'palette', label: 'Palette', icon: Palette, category: 'Creative' },
  { key: 'camera', label: 'Camera', icon: Camera, category: 'Creative' },
  { key: 'music', label: 'Music', icon: Music, category: 'Creative' },
  { key: 'headphones', label: 'Headphones', icon: Headphones, category: 'Creative' },
  { key: 'mic', label: 'Mic', icon: Mic, category: 'Creative' },
  { key: 'video', label: 'Video', icon: Video, category: 'Creative' },
  { key: 'gamepad2', label: 'Gaming', icon: Gamepad2, category: 'Creative' },

  // Misc
  { key: 'heart', label: 'Heart', icon: Heart, category: 'Misc' },
  { key: 'lightbulb', label: 'Lightbulb', icon: Lightbulb, category: 'Misc' },
  { key: 'folder', label: 'Folder', icon: Folder, category: 'Misc' },
  { key: 'lock', label: 'Lock', icon: Lock, category: 'Misc' },
  { key: 'key', label: 'Key', icon: Key, category: 'Misc' },
]

/** Map from icon key → lucide component */
export const iconMap: Record<string, LucideIcon> = Object.fromEntries(
  iconRegistry.map((e) => [e.key, e.icon])
)

/** Get unique categories preserving order */
export const iconCategories = [...new Set(iconRegistry.map((e) => e.category))]

/** Get icon component by key */
export function getIcon(key: string): LucideIcon | undefined {
  return iconMap[key]
}
