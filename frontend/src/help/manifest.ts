import type { Role } from '../pages/Login'

export interface HelpEntry {
  /** Short label shown on the tab (only when a role has more than one entry). */
  tabLabel: string
  /** Page title shown above the guide body for this entry. */
  title: string
  /** URL of the markdown guide (dummy = /help/*.md; later = S3-presigned URL). */
  guide: string
  /** URL of the walkthrough video ('' → renders "Video coming soon" placeholder). */
  video: string
}

/**
 * Per-role help entries. Most roles have a single entry; a role that spans
 * multiple feature areas (admin sees RC screens + Cash Reasonableness, etc.)
 * gets multiple entries rendered as tabs inside the User Guide panel.
 */
export const HELP_MANIFEST: Record<Role, HelpEntry[]> = {
  operator: [
    { tabLabel: 'Operator', title: 'Operator User Guide', guide: '/help/operator.md', video: '' },
  ],
  controller: [
    { tabLabel: 'Controller',         title: 'Controller User Guide',                    guide: '/help/controller.md',                   video: '' },
    { tabLabel: 'Cash Reasonableness',title: 'Cash Reasonableness — Controller Guide',   guide: '/help/cash-reasonableness-controller.md', video: '' },
  ],
  dgm: [
    { tabLabel: 'DGM', title: 'DGM User Guide', guide: '/help/dgm.md', video: '' },
  ],
  admin: [
    { tabLabel: 'Admin',              title: 'Admin User Guide',                      guide: '/help/admin.md',                        video: '' },
    { tabLabel: 'Regional Controller',title: 'Regional Controller User Guide',        guide: '/help/regional-controller.md',          video: '' },
    { tabLabel: 'Cash Reasonableness',title: 'Cash Reasonableness — Admin Guide',     guide: '/help/cash-reasonableness-admin.md',    video: '' },
  ],
  'regional-controller': [
    { tabLabel: 'Regional Controller', title: 'Regional Controller User Guide', guide: '/help/regional-controller.md', video: '' },
  ],
  'alarm-tester': [
    { tabLabel: 'Alarm Tester', title: 'Alarm Tester User Guide', guide: '/help/alarm-tester.md', video: '' },
  ],
  'alarm-approver': [
    { tabLabel: 'Alarm Approver', title: 'Alarm Approver User Guide', guide: '/help/alarm-approver.md', video: '' },
  ],
  'alarm-admin': [
    { tabLabel: 'Alarm Admin', title: 'Alarm Admin User Guide', guide: '/help/alarm-admin.md', video: '' },
  ],
}

export function getHelpEntries(role: Role): HelpEntry[] {
  return HELP_MANIFEST[role]
}
