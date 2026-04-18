import type { Role } from '../pages/Login'

/** One video walkthrough — label shown in the picker, url is the media source. */
export interface VideoEntry {
  label: string
  /** Dummy phase: relative path served from /public (e.g. '/help/videos/admin/audit-trail.mp4').
   *  Later: S3-presigned URL. */
  url: string
}

export interface HelpEntry {
  /** Short label shown on the section card heading (e.g. "Admin", "Regional Controller"). */
  tabLabel: string
  /** Page title shown above the guide body for this entry. */
  title: string
  /** URL of the markdown guide. Dummy phase = /help/*.md; later = S3-presigned URL. */
  guide: string
  /** Zero or more video walkthroughs for this section. Empty → "Video coming soon" placeholder. */
  videos: VideoEntry[]
}

/**
 * Per-role help entries. Most roles have a single entry; a role that spans
 * multiple feature areas (admin sees RC screens + Cash Reasonableness, etc.)
 * gets multiple entries rendered as tabs inside the User Guide panel.
 *
 * Each entry has its own `videos` array so users can jump between
 * feature-specific walkthroughs without leaving the section.
 */
export const HELP_MANIFEST: Record<Role, HelpEntry[]> = {
  operator: [
    { tabLabel: 'Operator', title: 'Operator User Guide', guide: '/help/operator.md', videos: [] },
  ],
  controller: [
    { tabLabel: 'Controller',         title: 'Controller User Guide',                    guide: '/help/controller.md',                   videos: [] },
    { tabLabel: 'Cash Reasonableness',title: 'Cash Reasonableness — Controller Guide',   guide: '/help/cash-reasonableness-controller.md', videos: [] },
  ],
  dgm: [
    { tabLabel: 'DGM', title: 'DGM User Guide', guide: '/help/dgm.md', videos: [] },
  ],
  admin: [
    {
      tabLabel: 'Admin',
      title: 'Admin User Guide',
      guide: '/help/admin.md',
      videos: [
        { label: 'Audit Trail', url: '/help/videos/admin/audit-trail.mp4' },
      ],
    },
    { tabLabel: 'Regional Controller',title: 'Regional Controller User Guide',        guide: '/help/regional-controller.md',          videos: [] },
    { tabLabel: 'Cash Reasonableness',title: 'Cash Reasonableness — Admin Guide',     guide: '/help/cash-reasonableness-admin.md',    videos: [] },
  ],
  'regional-controller': [
    { tabLabel: 'Regional Controller', title: 'Regional Controller User Guide', guide: '/help/regional-controller.md', videos: [] },
  ],
  'alarm-tester': [
    { tabLabel: 'Alarm Tester', title: 'Alarm Tester User Guide', guide: '/help/alarm-tester.md', videos: [] },
  ],
  'alarm-approver': [
    { tabLabel: 'Alarm Approver', title: 'Alarm Approver User Guide', guide: '/help/alarm-approver.md', videos: [] },
  ],
  'alarm-admin': [
    { tabLabel: 'Alarm Admin', title: 'Alarm Admin User Guide', guide: '/help/alarm-admin.md', videos: [] },
  ],
}

export function getHelpEntries(role: Role): HelpEntry[] {
  return HELP_MANIFEST[role]
}
