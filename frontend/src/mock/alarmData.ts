// =============================================================================
// Alarm Testing Compliance Module - Mock Data
// =============================================================================

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface AlarmUser {
  id: string;
  name: string;
  role: string;
  region: string;
}

export interface AlarmBuilding {
  id: string;
  locationId: string;
  name: string;
  region: string;
  securityCompanyName: string;
  securityCustomerId: string;
  securityCompanyPhone: string;
  status: 'active' | 'temporarily_exempt' | 'closed';
  exemptReason?: string;
  assignedTesters: string[];
  assignedApprover: string;
}

export interface AlarmZone {
  id: string;
  buildingId: string;
  zoneNumber: number;
  zoneName: string;
  zoneType: 'ENTRY_EXIT' | 'INTERIOR_MOTION' | 'PANIC_SILENT' | 'HOLDUP' | 'FIRE_SMOKE' | 'OTHER';
  areaNumber: number;
  isActive: boolean;
  otherDescription?: string;
}

export interface AlarmTestAttachment {
  id: string;
  alarmTestId: string;
  fileName: string;
  fileType: 'PDF' | 'EXCEL' | 'IMAGE';
  fileSize: number;
  uploadedAt: string;
}

export interface AlarmTest {
  id: string;
  buildingId: string;
  testDate: string;
  testMonth: string;
  testerId: string;
  testerName: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  testStartTime?: string;
  testEndTime?: string;
  notes?: string;
  zonesTotal: number;
  zonesTested: number;
  zonesIssue: number;
  attachments: AlarmTestAttachment[];
}

export interface AlarmTestZone {
  id: string;
  alarmTestId: string;
  alarmZoneId: string;
  result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND';
  alarmTriggeredAt?: string;
  alarmRestoredAt?: string;
  notes?: string;
}

export interface BiannualCheck {
  id: string;
  buildingId: string;
  checkType: 'CELLULAR_BACKUP' | 'CAMERA_BACKUP';
  checkDate: string;
  nextDueDate: string;
  checkedBy: string;
  checkedByName: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  evidencePath?: string;
  notes?: string;
}

export interface ComplianceRules {
  monthlyDeadlineDay: number;
  approvalSlaDays: number;
  requireAllZonesTested: boolean;
  requireReportUpload: boolean;
  requireApproverSignoff: boolean;
  escalation: {
    tier1: { daysBefore: number; recipients: string[] };
    tier2: { daysAfter: number; recipients: string[] };
    tier3: { daysAfter: number; recipients: string[] };
  };
  biannual: {
    cellularFrequencyMonths: number;
    cameraCheckFrequencyDays: number;
    reminderDaysBefore: number;
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const ALARM_USERS: AlarmUser[] = [
  { id: 'u-terri', name: 'Terri Serrano', role: 'DGM', region: 'Midwest' },
  { id: 'u-mike', name: 'Mike Chen', role: 'Controller', region: 'Midwest' },
  { id: 'u-sarah', name: 'Sarah Thompson', role: 'DGM', region: 'Southeast' },
  { id: 'u-james', name: 'James Wilson', role: 'Controller', region: 'Southeast' },
  { id: 'u-lisa', name: 'Lisa Martinez', role: 'DGM', region: 'Northeast' },
  { id: 'u-david', name: 'David Brown', role: 'Controller', region: 'Northeast' },
  { id: 'u-karen', name: 'Karen Davis', role: 'Safety Mgr', region: 'Midwest' },
  { id: 'u-robert', name: 'Robert Taylor', role: 'Safety Mgr', region: 'Southeast' },
  { id: 'u-jennifer', name: 'Jennifer Anderson', role: 'Safety Mgr', region: 'Northeast' },
];

// ---------------------------------------------------------------------------
// Compliance Rules
// ---------------------------------------------------------------------------

export const COMPLIANCE_RULES: ComplianceRules = {
  monthlyDeadlineDay: 28,
  approvalSlaDays: 5,
  requireAllZonesTested: true,
  requireReportUpload: true,
  requireApproverSignoff: true,
  escalation: {
    tier1: { daysBefore: 7, recipients: ['tester'] },
    tier2: { daysAfter: 0, recipients: ['tester', 'approver'] },
    tier3: { daysAfter: 3, recipients: ['tester', 'approver', 'regional'] },
  },
  biannual: {
    cellularFrequencyMonths: 6,
    cameraCheckFrequencyDays: 30,
    reminderDaysBefore: 30,
  },
};

// ---------------------------------------------------------------------------
// Buildings (12 total across 3 regions)
// ---------------------------------------------------------------------------

export const ALARM_BUILDINGS: AlarmBuilding[] = [
  // -- Midwest (4) --
  {
    id: 'bld-wausau',
    locationId: 'LOC-MW-001',
    name: 'Canteen Vending - Wausau',
    region: 'Midwest',
    securityCompanyName: 'AES IntelliNet',
    securityCustomerId: 'AES9925',
    securityCompanyPhone: '(800) 555-0101',
    status: 'active',
    assignedTesters: ['u-terri', 'u-karen'],
    assignedApprover: 'u-mike',
  },
  {
    id: 'bld-madison',
    locationId: 'LOC-MW-002',
    name: 'Canteen Vending - Madison',
    region: 'Midwest',
    securityCompanyName: 'ADT Commercial',
    securityCustomerId: 'ADT44210',
    securityCompanyPhone: '(800) 555-0102',
    status: 'active',
    assignedTesters: ['u-terri'],
    assignedApprover: 'u-mike',
  },
  {
    id: 'bld-milwaukee',
    locationId: 'LOC-MW-003',
    name: 'Canteen Vending - Milwaukee',
    region: 'Midwest',
    securityCompanyName: 'Securitas',
    securityCustomerId: 'SEC77830',
    securityCompanyPhone: '(800) 555-0103',
    status: 'active',
    assignedTesters: ['u-karen'],
    assignedApprover: 'u-mike',
  },
  {
    id: 'bld-chicago',
    locationId: 'LOC-MW-004',
    name: 'Canteen Vending - Chicago',
    region: 'Midwest',
    securityCompanyName: 'AES IntelliNet',
    securityCustomerId: 'AES8812',
    securityCompanyPhone: '(800) 555-0104',
    status: 'temporarily_exempt',
    exemptReason: 'Building undergoing major HVAC renovation; alarm panels relocated. Expected completion April 2026.',
    assignedTesters: ['u-terri', 'u-karen'],
    assignedApprover: 'u-mike',
  },
  // -- Southeast (4) --
  {
    id: 'bld-atlanta',
    locationId: 'LOC-SE-001',
    name: 'Canteen Vending - Atlanta',
    region: 'Southeast',
    securityCompanyName: 'ADT Commercial',
    securityCustomerId: 'ADT55120',
    securityCompanyPhone: '(800) 555-0201',
    status: 'active',
    assignedTesters: ['u-sarah', 'u-robert'],
    assignedApprover: 'u-james',
  },
  {
    id: 'bld-charlotte',
    locationId: 'LOC-SE-002',
    name: 'Canteen Vending - Charlotte',
    region: 'Southeast',
    securityCompanyName: 'Brinks Home Security',
    securityCustomerId: 'BRK33012',
    securityCompanyPhone: '(800) 555-0202',
    status: 'active',
    assignedTesters: ['u-sarah'],
    assignedApprover: 'u-james',
  },
  {
    id: 'bld-nashville',
    locationId: 'LOC-SE-003',
    name: 'Canteen Vending - Nashville',
    region: 'Southeast',
    securityCompanyName: 'Vivint Smart Home',
    securityCustomerId: 'VIV90231',
    securityCompanyPhone: '(800) 555-0203',
    status: 'active',
    assignedTesters: ['u-robert'],
    assignedApprover: 'u-james',
  },
  {
    id: 'bld-jacksonville',
    locationId: 'LOC-SE-004',
    name: 'Canteen Vending - Jacksonville',
    region: 'Southeast',
    securityCompanyName: 'ADT Commercial',
    securityCustomerId: 'ADT55198',
    securityCompanyPhone: '(800) 555-0204',
    status: 'closed',
    exemptReason: 'Facility permanently closed effective December 2025.',
    assignedTesters: ['u-robert'],
    assignedApprover: 'u-james',
  },
  // -- Northeast (4) --
  {
    id: 'bld-boston',
    locationId: 'LOC-NE-001',
    name: 'Canteen Vending - Boston',
    region: 'Northeast',
    securityCompanyName: 'SimpliSafe Business',
    securityCustomerId: 'SSB20145',
    securityCompanyPhone: '(800) 555-0301',
    status: 'active',
    assignedTesters: ['u-lisa', 'u-jennifer'],
    assignedApprover: 'u-david',
  },
  {
    id: 'bld-newyork',
    locationId: 'LOC-NE-002',
    name: 'Canteen Vending - New York',
    region: 'Northeast',
    securityCompanyName: 'Securitas',
    securityCustomerId: 'SEC88401',
    securityCompanyPhone: '(800) 555-0302',
    status: 'active',
    assignedTesters: ['u-lisa'],
    assignedApprover: 'u-david',
  },
  {
    id: 'bld-philadelphia',
    locationId: 'LOC-NE-003',
    name: 'Canteen Vending - Philadelphia',
    region: 'Northeast',
    securityCompanyName: 'ADT Commercial',
    securityCustomerId: 'ADT66230',
    securityCompanyPhone: '(800) 555-0303',
    status: 'active',
    assignedTesters: ['u-jennifer'],
    assignedApprover: 'u-david',
  },
  {
    id: 'bld-hartford',
    locationId: 'LOC-NE-004',
    name: 'Canteen Vending - Hartford',
    region: 'Northeast',
    securityCompanyName: 'Brinks Home Security',
    securityCustomerId: 'BRK33098',
    securityCompanyPhone: '(800) 555-0304',
    status: 'active',
    assignedTesters: ['u-lisa', 'u-jennifer'],
    assignedApprover: 'u-david',
  },
];

// ---------------------------------------------------------------------------
// Zones (150+ total)
// ---------------------------------------------------------------------------

export const ALARM_ZONES: AlarmZone[] = [
  // =========================================================================
  // Wausau - 18 zones (exact from PDF)
  // =========================================================================
  { id: 'zone-wausau-3', buildingId: 'bld-wausau', zoneNumber: 3, zoneName: 'Main Entry Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-5', buildingId: 'bld-wausau', zoneNumber: 5, zoneName: 'North Door Vehicle Storage', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-6', buildingId: 'bld-wausau', zoneNumber: 6, zoneName: 'East Employee Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-7', buildingId: 'bld-wausau', zoneNumber: 7, zoneName: 'North OHD', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-8', buildingId: 'bld-wausau', zoneNumber: 8, zoneName: 'Secure Office Door', zoneType: 'ENTRY_EXIT', areaNumber: 2, isActive: true },
  { id: 'zone-wausau-9', buildingId: 'bld-wausau', zoneNumber: 9, zoneName: 'South Vehicle OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-10', buildingId: 'bld-wausau', zoneNumber: 10, zoneName: 'East OH Door North', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-11', buildingId: 'bld-wausau', zoneNumber: 11, zoneName: 'East OH Door Central', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-12', buildingId: 'bld-wausau', zoneNumber: 12, zoneName: 'East OH Door South', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-13', buildingId: 'bld-wausau', zoneNumber: 13, zoneName: 'South OHD', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-14', buildingId: 'bld-wausau', zoneNumber: 14, zoneName: 'Motion South End Main Hallway', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-15', buildingId: 'bld-wausau', zoneNumber: 15, zoneName: 'Motion North End Main Hallway', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-17', buildingId: 'bld-wausau', zoneNumber: 17, zoneName: 'Cooler Door Motion', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-18', buildingId: 'bld-wausau', zoneNumber: 18, zoneName: 'Panic Button Front Office 1', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-19', buildingId: 'bld-wausau', zoneNumber: 19, zoneName: 'Secure Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-wausau-20', buildingId: 'bld-wausau', zoneNumber: 20, zoneName: 'Freezer Panic Alarm', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-21', buildingId: 'bld-wausau', zoneNumber: 21, zoneName: 'Cooler Panic Alarm', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-wausau-24', buildingId: 'bld-wausau', zoneNumber: 24, zoneName: 'Main Office Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },

  // =========================================================================
  // Madison - 12 zones
  // =========================================================================
  { id: 'zone-madison-1', buildingId: 'bld-madison', zoneNumber: 1, zoneName: 'Front Lobby Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-2', buildingId: 'bld-madison', zoneNumber: 2, zoneName: 'Rear Loading Dock Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-3', buildingId: 'bld-madison', zoneNumber: 3, zoneName: 'Side Employee Entrance', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-4', buildingId: 'bld-madison', zoneNumber: 4, zoneName: 'Warehouse OH Door A', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-5', buildingId: 'bld-madison', zoneNumber: 5, zoneName: 'Warehouse OH Door B', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-6', buildingId: 'bld-madison', zoneNumber: 6, zoneName: 'Office Corridor Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-madison-7', buildingId: 'bld-madison', zoneNumber: 7, zoneName: 'Warehouse Floor Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-madison-8', buildingId: 'bld-madison', zoneNumber: 8, zoneName: 'Front Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-9', buildingId: 'bld-madison', zoneNumber: 9, zoneName: 'Manager Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-madison-10', buildingId: 'bld-madison', zoneNumber: 10, zoneName: 'Break Room Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-madison-11', buildingId: 'bld-madison', zoneNumber: 11, zoneName: 'Warehouse Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-madison-12', buildingId: 'bld-madison', zoneNumber: 12, zoneName: 'Server Room Heat Detector', zoneType: 'FIRE_SMOKE', areaNumber: 2, isActive: true },

  // =========================================================================
  // Milwaukee - 10 zones
  // =========================================================================
  { id: 'zone-milwaukee-1', buildingId: 'bld-milwaukee', zoneNumber: 1, zoneName: 'Main Entry', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-2', buildingId: 'bld-milwaukee', zoneNumber: 2, zoneName: 'Dock Door East', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-3', buildingId: 'bld-milwaukee', zoneNumber: 3, zoneName: 'Dock Door West', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-4', buildingId: 'bld-milwaukee', zoneNumber: 4, zoneName: 'Employee Side Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-5', buildingId: 'bld-milwaukee', zoneNumber: 5, zoneName: 'Warehouse Motion North', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-6', buildingId: 'bld-milwaukee', zoneNumber: 6, zoneName: 'Warehouse Motion South', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-7', buildingId: 'bld-milwaukee', zoneNumber: 7, zoneName: 'Office Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-8', buildingId: 'bld-milwaukee', zoneNumber: 8, zoneName: 'Reception Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-milwaukee-9', buildingId: 'bld-milwaukee', zoneNumber: 9, zoneName: 'Cash Room Holdup', zoneType: 'HOLDUP', areaNumber: 2, isActive: true },
  { id: 'zone-milwaukee-10', buildingId: 'bld-milwaukee', zoneNumber: 10, zoneName: 'Kitchen Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },

  // =========================================================================
  // Chicago - 15 zones
  // =========================================================================
  { id: 'zone-chicago-1', buildingId: 'bld-chicago', zoneNumber: 1, zoneName: 'Main Entrance', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-2', buildingId: 'bld-chicago', zoneNumber: 2, zoneName: 'South Employee Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-3', buildingId: 'bld-chicago', zoneNumber: 3, zoneName: 'North Receiving Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-4', buildingId: 'bld-chicago', zoneNumber: 4, zoneName: 'East Loading Bay OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-5', buildingId: 'bld-chicago', zoneNumber: 5, zoneName: 'West Loading Bay OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-6', buildingId: 'bld-chicago', zoneNumber: 6, zoneName: 'Stairwell Door Floor 1', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-7', buildingId: 'bld-chicago', zoneNumber: 7, zoneName: 'Stairwell Door Floor 2', zoneType: 'ENTRY_EXIT', areaNumber: 2, isActive: true },
  { id: 'zone-chicago-8', buildingId: 'bld-chicago', zoneNumber: 8, zoneName: 'Lobby Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-9', buildingId: 'bld-chicago', zoneNumber: 9, zoneName: 'Hallway Motion Floor 1', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-10', buildingId: 'bld-chicago', zoneNumber: 10, zoneName: 'Hallway Motion Floor 2', zoneType: 'INTERIOR_MOTION', areaNumber: 2, isActive: true },
  { id: 'zone-chicago-11', buildingId: 'bld-chicago', zoneNumber: 11, zoneName: 'Warehouse Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-12', buildingId: 'bld-chicago', zoneNumber: 12, zoneName: 'Front Desk Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-13', buildingId: 'bld-chicago', zoneNumber: 13, zoneName: 'Manager Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-chicago-14', buildingId: 'bld-chicago', zoneNumber: 14, zoneName: 'Warehouse Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-chicago-15', buildingId: 'bld-chicago', zoneNumber: 15, zoneName: 'Server Closet Heat Detector', zoneType: 'FIRE_SMOKE', areaNumber: 2, isActive: true },

  // =========================================================================
  // Atlanta - 14 zones
  // =========================================================================
  { id: 'zone-atlanta-1', buildingId: 'bld-atlanta', zoneNumber: 1, zoneName: 'Main Entry Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-2', buildingId: 'bld-atlanta', zoneNumber: 2, zoneName: 'Side Entry Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-3', buildingId: 'bld-atlanta', zoneNumber: 3, zoneName: 'Rear Emergency Exit', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-4', buildingId: 'bld-atlanta', zoneNumber: 4, zoneName: 'Loading Dock Door A', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-5', buildingId: 'bld-atlanta', zoneNumber: 5, zoneName: 'Loading Dock Door B', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-6', buildingId: 'bld-atlanta', zoneNumber: 6, zoneName: 'Loading Dock OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-7', buildingId: 'bld-atlanta', zoneNumber: 7, zoneName: 'Office Hallway Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-8', buildingId: 'bld-atlanta', zoneNumber: 8, zoneName: 'Warehouse Aisle Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-9', buildingId: 'bld-atlanta', zoneNumber: 9, zoneName: 'Break Room Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-10', buildingId: 'bld-atlanta', zoneNumber: 10, zoneName: 'Front Desk Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-11', buildingId: 'bld-atlanta', zoneNumber: 11, zoneName: 'Cash Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-atlanta-12', buildingId: 'bld-atlanta', zoneNumber: 12, zoneName: 'Cash Room Holdup', zoneType: 'HOLDUP', areaNumber: 2, isActive: true },
  { id: 'zone-atlanta-13', buildingId: 'bld-atlanta', zoneNumber: 13, zoneName: 'Kitchen Fire Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-atlanta-14', buildingId: 'bld-atlanta', zoneNumber: 14, zoneName: 'Electrical Room Smoke', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },

  // =========================================================================
  // Charlotte - 11 zones
  // =========================================================================
  { id: 'zone-charlotte-1', buildingId: 'bld-charlotte', zoneNumber: 1, zoneName: 'Front Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-2', buildingId: 'bld-charlotte', zoneNumber: 2, zoneName: 'Employee Entrance', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-3', buildingId: 'bld-charlotte', zoneNumber: 3, zoneName: 'Loading Dock Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-4', buildingId: 'bld-charlotte', zoneNumber: 4, zoneName: 'Warehouse OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-5', buildingId: 'bld-charlotte', zoneNumber: 5, zoneName: 'Emergency Exit South', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-6', buildingId: 'bld-charlotte', zoneNumber: 6, zoneName: 'Main Hallway Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-7', buildingId: 'bld-charlotte', zoneNumber: 7, zoneName: 'Warehouse Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-8', buildingId: 'bld-charlotte', zoneNumber: 8, zoneName: 'Front Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-9', buildingId: 'bld-charlotte', zoneNumber: 9, zoneName: 'Dispatch Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-10', buildingId: 'bld-charlotte', zoneNumber: 10, zoneName: 'Warehouse Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-charlotte-11', buildingId: 'bld-charlotte', zoneNumber: 11, zoneName: 'Cooler Temperature Alert', zoneType: 'OTHER', areaNumber: 1, isActive: true, otherDescription: 'Temperature monitoring sensor for walk-in cooler' },

  // =========================================================================
  // Nashville - 13 zones
  // =========================================================================
  { id: 'zone-nashville-1', buildingId: 'bld-nashville', zoneNumber: 1, zoneName: 'Front Entry', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-2', buildingId: 'bld-nashville', zoneNumber: 2, zoneName: 'Rear Entry', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-3', buildingId: 'bld-nashville', zoneNumber: 3, zoneName: 'Dock Door 1', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-4', buildingId: 'bld-nashville', zoneNumber: 4, zoneName: 'Dock Door 2', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-5', buildingId: 'bld-nashville', zoneNumber: 5, zoneName: 'OH Door North', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-6', buildingId: 'bld-nashville', zoneNumber: 6, zoneName: 'OH Door South', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-7', buildingId: 'bld-nashville', zoneNumber: 7, zoneName: 'Office Motion Sensor', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-8', buildingId: 'bld-nashville', zoneNumber: 8, zoneName: 'Warehouse Motion East', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-9', buildingId: 'bld-nashville', zoneNumber: 9, zoneName: 'Warehouse Motion West', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-10', buildingId: 'bld-nashville', zoneNumber: 10, zoneName: 'Reception Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-11', buildingId: 'bld-nashville', zoneNumber: 11, zoneName: 'Manager Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-nashville-12', buildingId: 'bld-nashville', zoneNumber: 12, zoneName: 'Teller Window Holdup', zoneType: 'HOLDUP', areaNumber: 2, isActive: true },
  { id: 'zone-nashville-13', buildingId: 'bld-nashville', zoneNumber: 13, zoneName: 'Kitchen Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },

  // =========================================================================
  // Jacksonville - 8 zones (closed building)
  // =========================================================================
  { id: 'zone-jacksonville-1', buildingId: 'bld-jacksonville', zoneNumber: 1, zoneName: 'Front Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-2', buildingId: 'bld-jacksonville', zoneNumber: 2, zoneName: 'Back Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-3', buildingId: 'bld-jacksonville', zoneNumber: 3, zoneName: 'Dock Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-4', buildingId: 'bld-jacksonville', zoneNumber: 4, zoneName: 'Warehouse Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-5', buildingId: 'bld-jacksonville', zoneNumber: 5, zoneName: 'Office Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-6', buildingId: 'bld-jacksonville', zoneNumber: 6, zoneName: 'Front Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-7', buildingId: 'bld-jacksonville', zoneNumber: 7, zoneName: 'Warehouse Smoke', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: false },
  { id: 'zone-jacksonville-8', buildingId: 'bld-jacksonville', zoneNumber: 8, zoneName: 'Freezer Temp Alert', zoneType: 'OTHER', areaNumber: 1, isActive: false, otherDescription: 'Freezer temperature monitoring' },

  // =========================================================================
  // Boston - 15 zones
  // =========================================================================
  { id: 'zone-boston-1', buildingId: 'bld-boston', zoneNumber: 1, zoneName: 'Main Entrance', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-2', buildingId: 'bld-boston', zoneNumber: 2, zoneName: 'West Employee Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-3', buildingId: 'bld-boston', zoneNumber: 3, zoneName: 'East Service Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-4', buildingId: 'bld-boston', zoneNumber: 4, zoneName: 'Loading Bay Door A', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-5', buildingId: 'bld-boston', zoneNumber: 5, zoneName: 'Loading Bay Door B', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-6', buildingId: 'bld-boston', zoneNumber: 6, zoneName: 'Emergency Exit North', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-7', buildingId: 'bld-boston', zoneNumber: 7, zoneName: 'Emergency Exit South', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-8', buildingId: 'bld-boston', zoneNumber: 8, zoneName: 'Lobby Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-boston-9', buildingId: 'bld-boston', zoneNumber: 9, zoneName: 'Office Hallway Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-boston-10', buildingId: 'bld-boston', zoneNumber: 10, zoneName: 'Warehouse Floor Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-boston-11', buildingId: 'bld-boston', zoneNumber: 11, zoneName: 'Reception Desk Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-boston-12', buildingId: 'bld-boston', zoneNumber: 12, zoneName: 'Controller Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-boston-13', buildingId: 'bld-boston', zoneNumber: 13, zoneName: 'Vault Room Holdup', zoneType: 'HOLDUP', areaNumber: 2, isActive: true },
  { id: 'zone-boston-14', buildingId: 'bld-boston', zoneNumber: 14, zoneName: 'Warehouse Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-boston-15', buildingId: 'bld-boston', zoneNumber: 15, zoneName: 'Electrical Panel Smoke', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },

  // =========================================================================
  // New York - 22 zones (largest building)
  // =========================================================================
  { id: 'zone-newyork-1', buildingId: 'bld-newyork', zoneNumber: 1, zoneName: 'Main Entrance Ground Floor', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-2', buildingId: 'bld-newyork', zoneNumber: 2, zoneName: 'Service Entrance Ground Floor', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-3', buildingId: 'bld-newyork', zoneNumber: 3, zoneName: 'Employee Entrance East', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-4', buildingId: 'bld-newyork', zoneNumber: 4, zoneName: 'Employee Entrance West', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-5', buildingId: 'bld-newyork', zoneNumber: 5, zoneName: 'Loading Dock A', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-6', buildingId: 'bld-newyork', zoneNumber: 6, zoneName: 'Loading Dock B', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-7', buildingId: 'bld-newyork', zoneNumber: 7, zoneName: 'Loading Dock C', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-8', buildingId: 'bld-newyork', zoneNumber: 8, zoneName: 'Stairwell A Floor 1', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-9', buildingId: 'bld-newyork', zoneNumber: 9, zoneName: 'Stairwell A Floor 2', zoneType: 'ENTRY_EXIT', areaNumber: 2, isActive: true },
  { id: 'zone-newyork-10', buildingId: 'bld-newyork', zoneNumber: 10, zoneName: 'Stairwell B Floor 1', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-11', buildingId: 'bld-newyork', zoneNumber: 11, zoneName: 'Stairwell B Floor 2', zoneType: 'ENTRY_EXIT', areaNumber: 2, isActive: true },
  { id: 'zone-newyork-12', buildingId: 'bld-newyork', zoneNumber: 12, zoneName: 'Lobby Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-13', buildingId: 'bld-newyork', zoneNumber: 13, zoneName: 'Hallway Floor 1 Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-14', buildingId: 'bld-newyork', zoneNumber: 14, zoneName: 'Hallway Floor 2 Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 2, isActive: true },
  { id: 'zone-newyork-15', buildingId: 'bld-newyork', zoneNumber: 15, zoneName: 'Warehouse Motion North', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-16', buildingId: 'bld-newyork', zoneNumber: 16, zoneName: 'Warehouse Motion South', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-17', buildingId: 'bld-newyork', zoneNumber: 17, zoneName: 'Reception Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-18', buildingId: 'bld-newyork', zoneNumber: 18, zoneName: 'Executive Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-newyork-19', buildingId: 'bld-newyork', zoneNumber: 19, zoneName: 'Cash Room Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-newyork-20', buildingId: 'bld-newyork', zoneNumber: 20, zoneName: 'Dispatch Holdup', zoneType: 'HOLDUP', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-21', buildingId: 'bld-newyork', zoneNumber: 21, zoneName: 'Warehouse Smoke Floor 1', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-newyork-22', buildingId: 'bld-newyork', zoneNumber: 22, zoneName: 'Server Room Heat Detector', zoneType: 'FIRE_SMOKE', areaNumber: 2, isActive: true },

  // =========================================================================
  // Philadelphia - 12 zones
  // =========================================================================
  { id: 'zone-philadelphia-1', buildingId: 'bld-philadelphia', zoneNumber: 1, zoneName: 'Main Entry', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-2', buildingId: 'bld-philadelphia', zoneNumber: 2, zoneName: 'Employee Side Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-3', buildingId: 'bld-philadelphia', zoneNumber: 3, zoneName: 'Dock OH Door A', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-4', buildingId: 'bld-philadelphia', zoneNumber: 4, zoneName: 'Dock OH Door B', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-5', buildingId: 'bld-philadelphia', zoneNumber: 5, zoneName: 'Emergency Exit Rear', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-6', buildingId: 'bld-philadelphia', zoneNumber: 6, zoneName: 'Office Corridor Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-7', buildingId: 'bld-philadelphia', zoneNumber: 7, zoneName: 'Warehouse Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-8', buildingId: 'bld-philadelphia', zoneNumber: 8, zoneName: 'Loading Area Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-9', buildingId: 'bld-philadelphia', zoneNumber: 9, zoneName: 'Front Desk Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-10', buildingId: 'bld-philadelphia', zoneNumber: 10, zoneName: 'Accounting Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 2, isActive: true },
  { id: 'zone-philadelphia-11', buildingId: 'bld-philadelphia', zoneNumber: 11, zoneName: 'Break Room Smoke', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-philadelphia-12', buildingId: 'bld-philadelphia', zoneNumber: 12, zoneName: 'Warehouse Sprinkler Flow', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },

  // =========================================================================
  // Hartford - 14 zones
  // =========================================================================
  { id: 'zone-hartford-1', buildingId: 'bld-hartford', zoneNumber: 1, zoneName: 'Main Lobby Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-2', buildingId: 'bld-hartford', zoneNumber: 2, zoneName: 'North Employee Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-3', buildingId: 'bld-hartford', zoneNumber: 3, zoneName: 'South Employee Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-4', buildingId: 'bld-hartford', zoneNumber: 4, zoneName: 'Dock Door 1', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-5', buildingId: 'bld-hartford', zoneNumber: 5, zoneName: 'Dock Door 2', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-6', buildingId: 'bld-hartford', zoneNumber: 6, zoneName: 'Dock OH Door', zoneType: 'ENTRY_EXIT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-7', buildingId: 'bld-hartford', zoneNumber: 7, zoneName: 'Office Hallway Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-8', buildingId: 'bld-hartford', zoneNumber: 8, zoneName: 'Warehouse Motion North', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-9', buildingId: 'bld-hartford', zoneNumber: 9, zoneName: 'Warehouse Motion South', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-10', buildingId: 'bld-hartford', zoneNumber: 10, zoneName: 'Cooler Room Motion', zoneType: 'INTERIOR_MOTION', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-11', buildingId: 'bld-hartford', zoneNumber: 11, zoneName: 'Front Desk Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-12', buildingId: 'bld-hartford', zoneNumber: 12, zoneName: 'Manager Office Panic', zoneType: 'PANIC_SILENT', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-13', buildingId: 'bld-hartford', zoneNumber: 13, zoneName: 'Warehouse Smoke Detector', zoneType: 'FIRE_SMOKE', areaNumber: 1, isActive: true },
  { id: 'zone-hartford-14', buildingId: 'bld-hartford', zoneNumber: 14, zoneName: 'Freezer Temp Alarm', zoneType: 'OTHER', areaNumber: 1, isActive: true, otherDescription: 'Walk-in freezer temperature monitoring alarm' },
];

// ---------------------------------------------------------------------------
// Helper: get zones for a building
// ---------------------------------------------------------------------------
function zonesForBuilding(buildingId: string): AlarmZone[] {
  return ALARM_ZONES.filter((z) => z.buildingId === buildingId && z.isActive);
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export const ALARM_ATTACHMENTS: AlarmTestAttachment[] = [
  // Wausau Jan
  { id: 'att-wausau-2026-01-pdf', alarmTestId: 'test-wausau-2026-01', fileName: 'AES9925_CustomerActivityReport_Jan2026.pdf', fileType: 'PDF', fileSize: 245_760, uploadedAt: '2026-01-15T14:30:00Z' },
  // Wausau Feb
  { id: 'att-wausau-2026-02-pdf', alarmTestId: 'test-wausau-2026-02', fileName: 'AES9925_CustomerActivityReport_Feb2026.pdf', fileType: 'PDF', fileSize: 238_592, uploadedAt: '2026-02-12T10:45:00Z' },
  { id: 'att-wausau-2026-02-xls', alarmTestId: 'test-wausau-2026-02', fileName: 'Wausau_ZoneTestLog_Feb2026.xlsx', fileType: 'EXCEL', fileSize: 48_128, uploadedAt: '2026-02-12T10:46:00Z' },
  // Wausau Mar
  { id: 'att-wausau-2026-03-pdf', alarmTestId: 'test-wausau-2026-03', fileName: 'AES9925_CustomerActivityReport_Mar2026.pdf', fileType: 'PDF', fileSize: 251_904, uploadedAt: '2026-03-18T09:20:00Z' },
  // Madison Jan
  { id: 'att-madison-2026-01-pdf', alarmTestId: 'test-madison-2026-01', fileName: 'ADT44210_ActivityReport_Jan2026.pdf', fileType: 'PDF', fileSize: 198_656, uploadedAt: '2026-01-20T11:15:00Z' },
  // Madison Feb
  { id: 'att-madison-2026-02-pdf', alarmTestId: 'test-madison-2026-02', fileName: 'ADT44210_ActivityReport_Feb2026.pdf', fileType: 'PDF', fileSize: 201_728, uploadedAt: '2026-02-18T13:00:00Z' },
  // Madison Mar
  { id: 'att-madison-2026-03-pdf', alarmTestId: 'test-madison-2026-03', fileName: 'ADT44210_ActivityReport_Mar2026.pdf', fileType: 'PDF', fileSize: 205_312, uploadedAt: '2026-03-22T08:30:00Z' },
  // Milwaukee Jan
  { id: 'att-milwaukee-2026-01-pdf', alarmTestId: 'test-milwaukee-2026-01', fileName: 'SEC77830_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 178_176, uploadedAt: '2026-01-22T15:10:00Z' },
  // Milwaukee Feb
  { id: 'att-milwaukee-2026-02-pdf', alarmTestId: 'test-milwaukee-2026-02', fileName: 'SEC77830_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 182_272, uploadedAt: '2026-02-20T09:55:00Z' },
  // Milwaukee Mar
  { id: 'att-milwaukee-2026-03-pdf', alarmTestId: 'test-milwaukee-2026-03', fileName: 'SEC77830_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 180_224, uploadedAt: '2026-03-19T14:20:00Z' },
  // Atlanta Jan
  { id: 'att-atlanta-2026-01-pdf', alarmTestId: 'test-atlanta-2026-01', fileName: 'ADT55120_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 220_160, uploadedAt: '2026-01-18T10:30:00Z' },
  { id: 'att-atlanta-2026-01-xls', alarmTestId: 'test-atlanta-2026-01', fileName: 'Atlanta_ZoneLog_Jan2026.xlsx', fileType: 'EXCEL', fileSize: 52_224, uploadedAt: '2026-01-18T10:31:00Z' },
  // Atlanta Feb
  { id: 'att-atlanta-2026-02-pdf', alarmTestId: 'test-atlanta-2026-02', fileName: 'ADT55120_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 224_256, uploadedAt: '2026-02-16T11:00:00Z' },
  // Atlanta Mar
  { id: 'att-atlanta-2026-03-pdf', alarmTestId: 'test-atlanta-2026-03', fileName: 'ADT55120_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 218_112, uploadedAt: '2026-03-15T16:45:00Z' },
  // Charlotte Jan
  { id: 'att-charlotte-2026-01-pdf', alarmTestId: 'test-charlotte-2026-01', fileName: 'BRK33012_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 195_584, uploadedAt: '2026-01-21T14:20:00Z' },
  // Charlotte Feb
  { id: 'att-charlotte-2026-02-pdf', alarmTestId: 'test-charlotte-2026-02', fileName: 'BRK33012_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 199_680, uploadedAt: '2026-02-19T09:15:00Z' },
  // Charlotte Mar
  { id: 'att-charlotte-2026-03-pdf', alarmTestId: 'test-charlotte-2026-03', fileName: 'BRK33012_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 197_632, uploadedAt: '2026-03-20T10:00:00Z' },
  // Nashville Jan
  { id: 'att-nashville-2026-01-pdf', alarmTestId: 'test-nashville-2026-01', fileName: 'VIV90231_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 210_944, uploadedAt: '2026-01-19T16:30:00Z' },
  // Nashville Feb
  { id: 'att-nashville-2026-02-pdf', alarmTestId: 'test-nashville-2026-02', fileName: 'VIV90231_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 215_040, uploadedAt: '2026-02-17T08:50:00Z' },
  // Nashville Mar
  { id: 'att-nashville-2026-03-pdf', alarmTestId: 'test-nashville-2026-03', fileName: 'VIV90231_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 212_992, uploadedAt: '2026-03-21T13:40:00Z' },
  // Boston Jan
  { id: 'att-boston-2026-01-pdf', alarmTestId: 'test-boston-2026-01', fileName: 'SSB20145_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 230_400, uploadedAt: '2026-01-17T09:00:00Z' },
  // Boston Feb
  { id: 'att-boston-2026-02-pdf', alarmTestId: 'test-boston-2026-02', fileName: 'SSB20145_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 234_496, uploadedAt: '2026-02-14T14:15:00Z' },
  { id: 'att-boston-2026-02-img', alarmTestId: 'test-boston-2026-02', fileName: 'Boston_PanelPhoto_Feb2026.jpg', fileType: 'IMAGE', fileSize: 1_843_200, uploadedAt: '2026-02-14T14:16:00Z' },
  // Boston Mar
  { id: 'att-boston-2026-03-pdf', alarmTestId: 'test-boston-2026-03', fileName: 'SSB20145_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 228_352, uploadedAt: '2026-03-16T11:30:00Z' },
  // New York Jan
  { id: 'att-newyork-2026-01-pdf', alarmTestId: 'test-newyork-2026-01', fileName: 'SEC88401_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 290_816, uploadedAt: '2026-01-16T10:00:00Z' },
  { id: 'att-newyork-2026-01-xls', alarmTestId: 'test-newyork-2026-01', fileName: 'NewYork_ZoneLog_Jan2026.xlsx', fileType: 'EXCEL', fileSize: 67_584, uploadedAt: '2026-01-16T10:01:00Z' },
  // New York Feb
  { id: 'att-newyork-2026-02-pdf', alarmTestId: 'test-newyork-2026-02', fileName: 'SEC88401_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 294_912, uploadedAt: '2026-02-15T09:30:00Z' },
  // New York Mar
  { id: 'att-newyork-2026-03-pdf', alarmTestId: 'test-newyork-2026-03', fileName: 'SEC88401_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 288_768, uploadedAt: '2026-03-17T15:00:00Z' },
  // Philadelphia Jan
  { id: 'att-philadelphia-2026-01-pdf', alarmTestId: 'test-philadelphia-2026-01', fileName: 'ADT66230_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 202_752, uploadedAt: '2026-01-23T11:45:00Z' },
  // Philadelphia Feb
  { id: 'att-philadelphia-2026-02-pdf', alarmTestId: 'test-philadelphia-2026-02', fileName: 'ADT66230_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 206_848, uploadedAt: '2026-02-21T10:20:00Z' },
  // Philadelphia Mar
  { id: 'att-philadelphia-2026-03-pdf', alarmTestId: 'test-philadelphia-2026-03', fileName: 'ADT66230_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 204_800, uploadedAt: '2026-03-23T14:00:00Z' },
  // Hartford Jan
  { id: 'att-hartford-2026-01-pdf', alarmTestId: 'test-hartford-2026-01', fileName: 'BRK33098_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 215_040, uploadedAt: '2026-01-24T13:00:00Z' },
  // Hartford Feb
  { id: 'att-hartford-2026-02-pdf', alarmTestId: 'test-hartford-2026-02', fileName: 'BRK33098_Report_Feb2026.pdf', fileType: 'PDF', fileSize: 219_136, uploadedAt: '2026-02-22T09:40:00Z' },
  // Hartford Mar
  { id: 'att-hartford-2026-03-pdf', alarmTestId: 'test-hartford-2026-03', fileName: 'BRK33098_Report_Mar2026.pdf', fileType: 'PDF', fileSize: 217_088, uploadedAt: '2026-03-24T11:15:00Z' },
  // Chicago Feb (one-off before exemption took effect mid-Jan)
  { id: 'att-chicago-2026-01-pdf', alarmTestId: 'test-chicago-2026-01', fileName: 'AES8812_Report_Jan2026.pdf', fileType: 'PDF', fileSize: 240_640, uploadedAt: '2026-01-10T10:00:00Z' },
];

// ---------------------------------------------------------------------------
// Tests (42 total)
// ---------------------------------------------------------------------------

export const ALARM_TESTS: AlarmTest[] = [
  // =========================================================================
  // WAUSAU (3 tests: Jan APPROVED, Feb APPROVED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-wausau-2026-01',
    buildingId: 'bld-wausau',
    testDate: '2026-01-15',
    testMonth: '2026-01',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'APPROVED',
    submittedAt: '2026-01-15T14:35:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-01-16T09:00:00Z',
    testStartTime: '2026-01-15T08:00:00Z',
    testEndTime: '2026-01-15T09:45:00Z',
    notes: 'All zones tested successfully. Security company confirmed all signals received.',
    zonesTotal: 18,
    zonesTested: 18,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-wausau-2026-01-pdf')!],
  },
  {
    id: 'test-wausau-2026-02',
    buildingId: 'bld-wausau',
    testDate: '2026-02-12',
    testMonth: '2026-02',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'APPROVED',
    submittedAt: '2026-02-12T10:50:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-02-13T08:30:00Z',
    testStartTime: '2026-02-12T07:30:00Z',
    testEndTime: '2026-02-12T09:15:00Z',
    notes: 'Complete test. Zone 17 (Cooler Door Motion) required second attempt due to slow sensor response.',
    zonesTotal: 18,
    zonesTested: 18,
    zonesIssue: 0,
    attachments: ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === 'test-wausau-2026-02'),
  },
  {
    id: 'test-wausau-2026-03',
    buildingId: 'bld-wausau',
    testDate: '2026-03-18',
    testMonth: '2026-03',
    testerId: 'u-karen',
    testerName: 'Karen Davis',
    status: 'SUBMITTED',
    submittedAt: '2026-03-18T09:25:00Z',
    testStartTime: '2026-03-18T07:00:00Z',
    testEndTime: '2026-03-18T08:50:00Z',
    notes: 'All zones tested. Awaiting approval.',
    zonesTotal: 18,
    zonesTested: 18,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-wausau-2026-03-pdf')!],
  },

  // =========================================================================
  // MADISON (3 tests: Jan APPROVED, Feb REJECTED, Mar DRAFT)
  // =========================================================================
  {
    id: 'test-madison-2026-01',
    buildingId: 'bld-madison',
    testDate: '2026-01-20',
    testMonth: '2026-01',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'APPROVED',
    submittedAt: '2026-01-20T11:20:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-01-21T10:00:00Z',
    testStartTime: '2026-01-20T08:30:00Z',
    testEndTime: '2026-01-20T10:00:00Z',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-madison-2026-01-pdf')!],
  },
  {
    id: 'test-madison-2026-02',
    buildingId: 'bld-madison',
    testDate: '2026-02-18',
    testMonth: '2026-02',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'REJECTED',
    submittedAt: '2026-02-18T13:05:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-02-19T09:00:00Z',
    rejectionReason: 'Zone 10 (Break Room Smoke Detector) was not tested. All zones must be tested per policy.',
    testStartTime: '2026-02-18T09:00:00Z',
    testEndTime: '2026-02-18T10:30:00Z',
    zonesTotal: 12,
    zonesTested: 11,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-madison-2026-02-pdf')!],
  },
  {
    id: 'test-madison-2026-03',
    buildingId: 'bld-madison',
    testDate: '2026-03-22',
    testMonth: '2026-03',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'DRAFT',
    testStartTime: '2026-03-22T08:00:00Z',
    testEndTime: '2026-03-22T09:30:00Z',
    notes: 'Test complete, need to upload report before submitting.',
    zonesTotal: 12,
    zonesTested: 10,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-madison-2026-03-pdf')!],
  },

  // =========================================================================
  // MILWAUKEE (3 tests: Jan APPROVED, Feb APPROVED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-milwaukee-2026-01',
    buildingId: 'bld-milwaukee',
    testDate: '2026-01-22',
    testMonth: '2026-01',
    testerId: 'u-karen',
    testerName: 'Karen Davis',
    status: 'APPROVED',
    submittedAt: '2026-01-22T15:15:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-01-23T08:30:00Z',
    testStartTime: '2026-01-22T12:00:00Z',
    testEndTime: '2026-01-22T13:15:00Z',
    zonesTotal: 10,
    zonesTested: 10,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-milwaukee-2026-01-pdf')!],
  },
  {
    id: 'test-milwaukee-2026-02',
    buildingId: 'bld-milwaukee',
    testDate: '2026-02-20',
    testMonth: '2026-02',
    testerId: 'u-karen',
    testerName: 'Karen Davis',
    status: 'APPROVED',
    submittedAt: '2026-02-20T10:00:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-02-21T09:00:00Z',
    testStartTime: '2026-02-20T07:30:00Z',
    testEndTime: '2026-02-20T08:45:00Z',
    zonesTotal: 10,
    zonesTested: 10,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-milwaukee-2026-02-pdf')!],
  },
  {
    id: 'test-milwaukee-2026-03',
    buildingId: 'bld-milwaukee',
    testDate: '2026-03-19',
    testMonth: '2026-03',
    testerId: 'u-karen',
    testerName: 'Karen Davis',
    status: 'SUBMITTED',
    submittedAt: '2026-03-19T14:25:00Z',
    testStartTime: '2026-03-19T11:00:00Z',
    testEndTime: '2026-03-19T12:10:00Z',
    zonesTotal: 10,
    zonesTested: 10,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-milwaukee-2026-03-pdf')!],
  },

  // =========================================================================
  // CHICAGO (1 test: Jan APPROVED, then exempt)
  // =========================================================================
  {
    id: 'test-chicago-2026-01',
    buildingId: 'bld-chicago',
    testDate: '2026-01-10',
    testMonth: '2026-01',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'APPROVED',
    submittedAt: '2026-01-10T10:05:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-01-11T08:00:00Z',
    testStartTime: '2026-01-10T07:00:00Z',
    testEndTime: '2026-01-10T08:30:00Z',
    notes: 'Final test before HVAC renovation begins. Building exempt starting Feb.',
    zonesTotal: 15,
    zonesTested: 15,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-chicago-2026-01-pdf')!],
  },

  // =========================================================================
  // ATLANTA (3 tests: Jan APPROVED, Feb APPROVED, Mar REJECTED)
  // =========================================================================
  {
    id: 'test-atlanta-2026-01',
    buildingId: 'bld-atlanta',
    testDate: '2026-01-18',
    testMonth: '2026-01',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'APPROVED',
    submittedAt: '2026-01-18T10:35:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-01-19T09:00:00Z',
    testStartTime: '2026-01-18T07:00:00Z',
    testEndTime: '2026-01-18T08:45:00Z',
    zonesTotal: 14,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === 'test-atlanta-2026-01'),
  },
  {
    id: 'test-atlanta-2026-02',
    buildingId: 'bld-atlanta',
    testDate: '2026-02-16',
    testMonth: '2026-02',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'APPROVED',
    submittedAt: '2026-02-16T11:05:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-02-17T08:30:00Z',
    testStartTime: '2026-02-16T07:30:00Z',
    testEndTime: '2026-02-16T09:00:00Z',
    zonesTotal: 14,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-atlanta-2026-02-pdf')!],
  },
  {
    id: 'test-atlanta-2026-03',
    buildingId: 'bld-atlanta',
    testDate: '2026-03-15',
    testMonth: '2026-03',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'REJECTED',
    submittedAt: '2026-03-15T16:50:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-03-16T10:00:00Z',
    rejectionReason: 'Zone 12 (Cash Room Holdup) reported ISSUE_FOUND but no follow-up documented. Please re-test holdup zone and document resolution.',
    testStartTime: '2026-03-15T14:00:00Z',
    testEndTime: '2026-03-15T15:30:00Z',
    zonesTotal: 14,
    zonesTested: 13,
    zonesIssue: 1,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-atlanta-2026-03-pdf')!],
  },

  // =========================================================================
  // CHARLOTTE (3 tests: Jan APPROVED, Feb APPROVED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-charlotte-2026-01',
    buildingId: 'bld-charlotte',
    testDate: '2026-01-21',
    testMonth: '2026-01',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'APPROVED',
    submittedAt: '2026-01-21T14:25:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-01-22T09:30:00Z',
    testStartTime: '2026-01-21T11:00:00Z',
    testEndTime: '2026-01-21T12:15:00Z',
    zonesTotal: 11,
    zonesTested: 11,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-charlotte-2026-01-pdf')!],
  },
  {
    id: 'test-charlotte-2026-02',
    buildingId: 'bld-charlotte',
    testDate: '2026-02-19',
    testMonth: '2026-02',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'APPROVED',
    submittedAt: '2026-02-19T09:20:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-02-20T08:00:00Z',
    testStartTime: '2026-02-19T07:00:00Z',
    testEndTime: '2026-02-19T08:10:00Z',
    zonesTotal: 11,
    zonesTested: 11,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-charlotte-2026-02-pdf')!],
  },
  {
    id: 'test-charlotte-2026-03',
    buildingId: 'bld-charlotte',
    testDate: '2026-03-20',
    testMonth: '2026-03',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'SUBMITTED',
    submittedAt: '2026-03-20T10:05:00Z',
    testStartTime: '2026-03-20T07:30:00Z',
    testEndTime: '2026-03-20T08:40:00Z',
    zonesTotal: 11,
    zonesTested: 11,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-charlotte-2026-03-pdf')!],
  },

  // =========================================================================
  // NASHVILLE (3 tests: Jan APPROVED, Feb REJECTED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-nashville-2026-01',
    buildingId: 'bld-nashville',
    testDate: '2026-01-19',
    testMonth: '2026-01',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'APPROVED',
    submittedAt: '2026-01-19T16:35:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-01-20T09:00:00Z',
    testStartTime: '2026-01-19T13:00:00Z',
    testEndTime: '2026-01-19T14:30:00Z',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-nashville-2026-01-pdf')!],
  },
  {
    id: 'test-nashville-2026-02',
    buildingId: 'bld-nashville',
    testDate: '2026-02-17',
    testMonth: '2026-02',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'REJECTED',
    submittedAt: '2026-02-17T08:55:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-02-18T10:00:00Z',
    rejectionReason: 'Activity report from security company not attached. Please upload the Vivint report.',
    testStartTime: '2026-02-17T06:30:00Z',
    testEndTime: '2026-02-17T08:00:00Z',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-nashville-2026-02-pdf')!],
  },
  {
    id: 'test-nashville-2026-03',
    buildingId: 'bld-nashville',
    testDate: '2026-03-21',
    testMonth: '2026-03',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'SUBMITTED',
    submittedAt: '2026-03-21T13:45:00Z',
    testStartTime: '2026-03-21T10:00:00Z',
    testEndTime: '2026-03-21T11:30:00Z',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-nashville-2026-03-pdf')!],
  },

  // =========================================================================
  // BOSTON (3 tests: Jan APPROVED, Feb APPROVED, Mar DRAFT)
  // =========================================================================
  {
    id: 'test-boston-2026-01',
    buildingId: 'bld-boston',
    testDate: '2026-01-17',
    testMonth: '2026-01',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'APPROVED',
    submittedAt: '2026-01-17T09:05:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-18T08:00:00Z',
    testStartTime: '2026-01-17T06:30:00Z',
    testEndTime: '2026-01-17T08:15:00Z',
    zonesTotal: 15,
    zonesTested: 15,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-boston-2026-01-pdf')!],
  },
  {
    id: 'test-boston-2026-02',
    buildingId: 'bld-boston',
    testDate: '2026-02-14',
    testMonth: '2026-02',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'APPROVED',
    submittedAt: '2026-02-14T14:20:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-02-15T09:30:00Z',
    testStartTime: '2026-02-14T11:00:00Z',
    testEndTime: '2026-02-14T12:45:00Z',
    zonesTotal: 15,
    zonesTested: 15,
    zonesIssue: 0,
    attachments: ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === 'test-boston-2026-02'),
  },
  {
    id: 'test-boston-2026-03',
    buildingId: 'bld-boston',
    testDate: '2026-03-16',
    testMonth: '2026-03',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'DRAFT',
    testStartTime: '2026-03-16T09:00:00Z',
    testEndTime: '2026-03-16T10:45:00Z',
    notes: 'Test complete. Need to verify zone 13 result with security company before submitting.',
    zonesTotal: 15,
    zonesTested: 14,
    zonesIssue: 1,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-boston-2026-03-pdf')!],
  },

  // =========================================================================
  // NEW YORK (3 tests: Jan APPROVED, Feb APPROVED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-newyork-2026-01',
    buildingId: 'bld-newyork',
    testDate: '2026-01-16',
    testMonth: '2026-01',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'APPROVED',
    submittedAt: '2026-01-16T10:05:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-17T09:00:00Z',
    testStartTime: '2026-01-16T06:00:00Z',
    testEndTime: '2026-01-16T08:30:00Z',
    notes: 'Large facility - required two testers. All 22 zones passed.',
    zonesTotal: 22,
    zonesTested: 22,
    zonesIssue: 0,
    attachments: ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === 'test-newyork-2026-01'),
  },
  {
    id: 'test-newyork-2026-02',
    buildingId: 'bld-newyork',
    testDate: '2026-02-15',
    testMonth: '2026-02',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'APPROVED',
    submittedAt: '2026-02-15T09:35:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-02-16T08:00:00Z',
    testStartTime: '2026-02-15T06:00:00Z',
    testEndTime: '2026-02-15T08:15:00Z',
    zonesTotal: 22,
    zonesTested: 22,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-newyork-2026-02-pdf')!],
  },
  {
    id: 'test-newyork-2026-03',
    buildingId: 'bld-newyork',
    testDate: '2026-03-17',
    testMonth: '2026-03',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'SUBMITTED',
    submittedAt: '2026-03-17T15:05:00Z',
    testStartTime: '2026-03-17T06:00:00Z',
    testEndTime: '2026-03-17T08:20:00Z',
    zonesTotal: 22,
    zonesTested: 22,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-newyork-2026-03-pdf')!],
  },

  // =========================================================================
  // PHILADELPHIA (3 tests: Jan APPROVED, Feb REJECTED, Mar SUBMITTED)
  // =========================================================================
  {
    id: 'test-philadelphia-2026-01',
    buildingId: 'bld-philadelphia',
    testDate: '2026-01-23',
    testMonth: '2026-01',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'APPROVED',
    submittedAt: '2026-01-23T11:50:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-24T08:30:00Z',
    testStartTime: '2026-01-23T09:00:00Z',
    testEndTime: '2026-01-23T10:15:00Z',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-philadelphia-2026-01-pdf')!],
  },
  {
    id: 'test-philadelphia-2026-02',
    buildingId: 'bld-philadelphia',
    testDate: '2026-02-21',
    testMonth: '2026-02',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'REJECTED',
    submittedAt: '2026-02-21T10:25:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-02-22T09:00:00Z',
    rejectionReason: 'Two zones (11, 12) show ISSUE_FOUND but notes do not explain the issue or corrective action taken. Please add detailed notes.',
    testStartTime: '2026-02-21T07:30:00Z',
    testEndTime: '2026-02-21T09:00:00Z',
    zonesTotal: 12,
    zonesTested: 10,
    zonesIssue: 2,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-philadelphia-2026-02-pdf')!],
  },
  {
    id: 'test-philadelphia-2026-03',
    buildingId: 'bld-philadelphia',
    testDate: '2026-03-23',
    testMonth: '2026-03',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'SUBMITTED',
    submittedAt: '2026-03-23T14:05:00Z',
    testStartTime: '2026-03-23T11:00:00Z',
    testEndTime: '2026-03-23T12:20:00Z',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-philadelphia-2026-03-pdf')!],
  },

  // =========================================================================
  // HARTFORD (3 tests: Jan APPROVED, Feb APPROVED, Mar DRAFT)
  // =========================================================================
  {
    id: 'test-hartford-2026-01',
    buildingId: 'bld-hartford',
    testDate: '2026-01-24',
    testMonth: '2026-01',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'APPROVED',
    submittedAt: '2026-01-24T13:05:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-25T08:00:00Z',
    testStartTime: '2026-01-24T10:00:00Z',
    testEndTime: '2026-01-24T11:30:00Z',
    zonesTotal: 14,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-hartford-2026-01-pdf')!],
  },
  {
    id: 'test-hartford-2026-02',
    buildingId: 'bld-hartford',
    testDate: '2026-02-22',
    testMonth: '2026-02',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'APPROVED',
    submittedAt: '2026-02-22T09:45:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-02-23T08:30:00Z',
    testStartTime: '2026-02-22T07:00:00Z',
    testEndTime: '2026-02-22T08:30:00Z',
    zonesTotal: 14,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-hartford-2026-02-pdf')!],
  },
  {
    id: 'test-hartford-2026-03',
    buildingId: 'bld-hartford',
    testDate: '2026-03-24',
    testMonth: '2026-03',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'DRAFT',
    testStartTime: '2026-03-24T09:00:00Z',
    testEndTime: '2026-03-24T10:30:00Z',
    notes: 'Freezer temp alarm (zone 14) needs re-test; sensor may be faulty.',
    zonesTotal: 14,
    zonesTested: 13,
    zonesIssue: 1,
    attachments: [ALARM_ATTACHMENTS.find((a) => a.id === 'att-hartford-2026-03-pdf')!],
  },

  // =========================================================================
  // Additional REJECTED tests to reach count targets
  // =========================================================================
  {
    id: 'test-nashville-2026-02-r2',
    buildingId: 'bld-nashville',
    testDate: '2026-02-24',
    testMonth: '2026-02',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'REJECTED',
    submittedAt: '2026-02-24T11:00:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-02-25T09:00:00Z',
    rejectionReason: 'Resubmission still missing Vivint activity report attachment.',
    testStartTime: '2026-02-24T08:00:00Z',
    testEndTime: '2026-02-24T09:30:00Z',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [],
  },
  {
    id: 'test-boston-2026-01-r1',
    buildingId: 'bld-boston',
    testDate: '2026-01-10',
    testMonth: '2026-01',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'REJECTED',
    submittedAt: '2026-01-10T12:00:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-11T09:00:00Z',
    rejectionReason: 'Vault Room Holdup (zone 13) not tested. This is a critical zone that must be included.',
    testStartTime: '2026-01-10T09:00:00Z',
    testEndTime: '2026-01-10T10:30:00Z',
    zonesTotal: 15,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: [],
  },
  {
    id: 'test-newyork-2026-01-r1',
    buildingId: 'bld-newyork',
    testDate: '2026-01-09',
    testMonth: '2026-01',
    testerId: 'u-lisa',
    testerName: 'Lisa Martinez',
    status: 'REJECTED',
    submittedAt: '2026-01-09T11:00:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-01-10T08:00:00Z',
    rejectionReason: 'Test performed outside of normal scheduling window. Only 15 of 22 zones tested. Please complete full test.',
    testStartTime: '2026-01-09T06:00:00Z',
    testEndTime: '2026-01-09T07:30:00Z',
    zonesTotal: 22,
    zonesTested: 15,
    zonesIssue: 0,
    attachments: [],
  },

  // =========================================================================
  // Additional DRAFT tests
  // =========================================================================
  {
    id: 'test-atlanta-2026-03-d2',
    buildingId: 'bld-atlanta',
    testDate: '2026-03-25',
    testMonth: '2026-03',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'DRAFT',
    testStartTime: '2026-03-25T07:00:00Z',
    testEndTime: '2026-03-25T08:30:00Z',
    notes: 'Re-test after rejection. Cash room holdup zone re-tested. Preparing documentation.',
    zonesTotal: 14,
    zonesTested: 14,
    zonesIssue: 0,
    attachments: [],
  },
  {
    id: 'test-milwaukee-2026-03-d2',
    buildingId: 'bld-milwaukee',
    testDate: '2026-03-28',
    testMonth: '2026-03',
    testerId: 'u-karen',
    testerName: 'Karen Davis',
    status: 'DRAFT',
    testStartTime: '2026-03-28T10:00:00Z',
    notes: 'Started late-month supplemental test. In progress.',
    zonesTotal: 10,
    zonesTested: 5,
    zonesIssue: 0,
    attachments: [],
  },

  // =========================================================================
  // Additional SUBMITTED tests
  // =========================================================================
  {
    id: 'test-nashville-2026-02-s3',
    buildingId: 'bld-nashville',
    testDate: '2026-02-27',
    testMonth: '2026-02',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'SUBMITTED',
    submittedAt: '2026-02-27T15:00:00Z',
    testStartTime: '2026-02-27T12:00:00Z',
    testEndTime: '2026-02-27T13:30:00Z',
    notes: 'Third attempt for Feb. Vivint report now attached.',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [{ id: 'att-nashville-2026-02-s3-pdf', alarmTestId: 'test-nashville-2026-02-s3', fileName: 'VIV90231_Report_Feb2026_v2.pdf', fileType: 'PDF', fileSize: 218_112, uploadedAt: '2026-02-27T14:55:00Z' }],
  },
  {
    id: 'test-philadelphia-2026-02-s2',
    buildingId: 'bld-philadelphia',
    testDate: '2026-02-26',
    testMonth: '2026-02',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'SUBMITTED',
    submittedAt: '2026-02-26T16:00:00Z',
    testStartTime: '2026-02-26T13:00:00Z',
    testEndTime: '2026-02-26T14:30:00Z',
    notes: 'Re-test after rejection. All zones tested, detailed notes added for zone 11 and 12.',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [{ id: 'att-philadelphia-2026-02-s2-pdf', alarmTestId: 'test-philadelphia-2026-02-s2', fileName: 'ADT66230_Report_Feb2026_v2.pdf', fileType: 'PDF', fileSize: 210_944, uploadedAt: '2026-02-26T15:55:00Z' }],
  },

  // =========================================================================
  // Additional APPROVED tests to reach 20+ approved, 42+ total
  // =========================================================================
  {
    id: 'test-nashville-2026-02-a3',
    buildingId: 'bld-nashville',
    testDate: '2026-02-28',
    testMonth: '2026-02',
    testerId: 'u-robert',
    testerName: 'Robert Taylor',
    status: 'APPROVED',
    submittedAt: '2026-02-28T10:00:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-02-28T16:00:00Z',
    testStartTime: '2026-02-28T07:00:00Z',
    testEndTime: '2026-02-28T08:30:00Z',
    notes: 'Successful re-test for February after two prior rejections.',
    zonesTotal: 13,
    zonesTested: 13,
    zonesIssue: 0,
    attachments: [{ id: 'att-nashville-2026-02-a3-pdf', alarmTestId: 'test-nashville-2026-02-a3', fileName: 'VIV90231_Report_Feb2026_final.pdf', fileType: 'PDF', fileSize: 220_160, uploadedAt: '2026-02-28T09:55:00Z' }],
  },
  {
    id: 'test-philadelphia-2026-02-a2',
    buildingId: 'bld-philadelphia',
    testDate: '2026-02-27',
    testMonth: '2026-02',
    testerId: 'u-jennifer',
    testerName: 'Jennifer Anderson',
    status: 'APPROVED',
    submittedAt: '2026-02-27T11:00:00Z',
    approvedBy: 'u-david',
    approvedByName: 'David Brown',
    approvedAt: '2026-02-28T08:30:00Z',
    testStartTime: '2026-02-27T08:00:00Z',
    testEndTime: '2026-02-27T09:20:00Z',
    notes: 'Approved re-test after detailed notes were added for zones 11 and 12.',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [{ id: 'att-philadelphia-2026-02-a2-pdf', alarmTestId: 'test-philadelphia-2026-02-a2', fileName: 'ADT66230_Report_Feb2026_final.pdf', fileType: 'PDF', fileSize: 212_992, uploadedAt: '2026-02-27T10:55:00Z' }],
  },
  {
    id: 'test-madison-2026-02-a2',
    buildingId: 'bld-madison',
    testDate: '2026-02-25',
    testMonth: '2026-02',
    testerId: 'u-terri',
    testerName: 'Terri Serrano',
    status: 'APPROVED',
    submittedAt: '2026-02-25T14:00:00Z',
    approvedBy: 'u-mike',
    approvedByName: 'Mike Chen',
    approvedAt: '2026-02-26T08:00:00Z',
    testStartTime: '2026-02-25T11:00:00Z',
    testEndTime: '2026-02-25T12:30:00Z',
    notes: 'Re-test after rejection. All 12 zones including smoke detector tested successfully.',
    zonesTotal: 12,
    zonesTested: 12,
    zonesIssue: 0,
    attachments: [{ id: 'att-madison-2026-02-a2-pdf', alarmTestId: 'test-madison-2026-02-a2', fileName: 'ADT44210_ActivityReport_Feb2026_v2.pdf', fileType: 'PDF', fileSize: 204_800, uploadedAt: '2026-02-25T13:55:00Z' }],
  },
  {
    id: 'test-charlotte-2026-01-r1',
    buildingId: 'bld-charlotte',
    testDate: '2026-01-14',
    testMonth: '2026-01',
    testerId: 'u-sarah',
    testerName: 'Sarah Thompson',
    status: 'REJECTED',
    submittedAt: '2026-01-14T15:00:00Z',
    approvedBy: 'u-james',
    approvedByName: 'James Wilson',
    approvedAt: '2026-01-15T09:00:00Z',
    rejectionReason: 'Cooler Temperature Alert (zone 11) not tested. All zones including OTHER type must be included.',
    testStartTime: '2026-01-14T12:00:00Z',
    testEndTime: '2026-01-14T13:00:00Z',
    zonesTotal: 11,
    zonesTested: 10,
    zonesIssue: 0,
    attachments: [],
  },
];

// ---------------------------------------------------------------------------
// Test Zone Results
// ---------------------------------------------------------------------------

function generateTestZoneResults(
  test: AlarmTest,
  zones: AlarmZone[],
  options?: { notTestedZoneNumbers?: number[]; issueZoneNumbers?: number[] }
): AlarmTestZone[] {
  const notTested = new Set(options?.notTestedZoneNumbers ?? []);
  const issues = new Set(options?.issueZoneNumbers ?? []);
  const testDate = test.testDate;

  return zones.map((zone, idx) => {
    let result: AlarmTestZone['result'] = 'TESTED';
    let notes: string | undefined;
    let triggeredAt: string | undefined;
    let restoredAt: string | undefined;

    if (notTested.has(zone.zoneNumber)) {
      result = 'NOT_TESTED';
      notes = 'Zone could not be accessed during test window.';
    } else if (issues.has(zone.zoneNumber)) {
      result = 'ISSUE_FOUND';
      notes = 'Alarm did not trigger on first attempt. Sensor may need replacement.';
      triggeredAt = `${testDate}T${String(7 + Math.floor(idx / 6)).padStart(2, '0')}:${String(15 + (idx % 6) * 5).padStart(2, '0')}:00Z`;
    } else {
      const hour = 7 + Math.floor(idx / 6);
      const minute = (idx % 6) * 8;
      triggeredAt = `${testDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
      restoredAt = `${testDate}T${String(hour).padStart(2, '0')}:${String(minute + 2).padStart(2, '0')}:00Z`;
    }

    return {
      id: `tz-${test.id}-z${zone.zoneNumber}`,
      alarmTestId: test.id,
      alarmZoneId: zone.id,
      result,
      alarmTriggeredAt: triggeredAt,
      alarmRestoredAt: restoredAt,
      notes,
    };
  });
}

// Build all test zone results
const wausauZones = zonesForBuilding('bld-wausau');
const madisonZones = zonesForBuilding('bld-madison');
const milwaukeeZones = zonesForBuilding('bld-milwaukee');
const chicagoZones = zonesForBuilding('bld-chicago');
const atlantaZones = zonesForBuilding('bld-atlanta');
const charlotteZones = zonesForBuilding('bld-charlotte');
const nashvilleZones = zonesForBuilding('bld-nashville');
const bostonZones = zonesForBuilding('bld-boston');
const newyorkZones = zonesForBuilding('bld-newyork');
const philadelphiaZones = zonesForBuilding('bld-philadelphia');
const hartfordZones = zonesForBuilding('bld-hartford');

export const ALARM_TEST_ZONES: AlarmTestZone[] = [
  // Wausau Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-wausau-2026-01')!, wausauZones),
  // Wausau Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-wausau-2026-02')!, wausauZones),
  // Wausau Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-wausau-2026-03')!, wausauZones),

  // Madison Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-madison-2026-01')!, madisonZones),
  // Madison Feb - zone 10 not tested (rejected)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-madison-2026-02')!, madisonZones, { notTestedZoneNumbers: [10] }),
  // Madison Mar - zones 11, 12 not tested yet (draft)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-madison-2026-03')!, madisonZones, { notTestedZoneNumbers: [11, 12] }),

  // Milwaukee Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-milwaukee-2026-01')!, milwaukeeZones),
  // Milwaukee Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-milwaukee-2026-02')!, milwaukeeZones),
  // Milwaukee Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-milwaukee-2026-03')!, milwaukeeZones),

  // Chicago Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-chicago-2026-01')!, chicagoZones),

  // Atlanta Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-atlanta-2026-01')!, atlantaZones),
  // Atlanta Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-atlanta-2026-02')!, atlantaZones),
  // Atlanta Mar - zone 12 issue (rejected)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-atlanta-2026-03')!, atlantaZones, { issueZoneNumbers: [12] }),

  // Charlotte Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-charlotte-2026-01')!, charlotteZones),
  // Charlotte Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-charlotte-2026-02')!, charlotteZones),
  // Charlotte Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-charlotte-2026-03')!, charlotteZones),

  // Nashville Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-01')!, nashvilleZones),
  // Nashville Feb - all tested (rejected for missing attachment, not zone issue)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-02')!, nashvilleZones),
  // Nashville Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-03')!, nashvilleZones),

  // Boston initial rejected attempt - zone 13 not tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-boston-2026-01-r1')!, bostonZones, { notTestedZoneNumbers: [13] }),
  // Boston Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-boston-2026-01')!, bostonZones),
  // Boston Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-boston-2026-02')!, bostonZones),
  // Boston Mar - zone 13 issue (draft)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-boston-2026-03')!, bostonZones, { issueZoneNumbers: [13] }),

  // New York initial rejected attempt - many zones not tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-newyork-2026-01-r1')!, newyorkZones, { notTestedZoneNumbers: [16, 17, 18, 19, 20, 21, 22] }),
  // New York Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-newyork-2026-01')!, newyorkZones),
  // New York Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-newyork-2026-02')!, newyorkZones),
  // New York Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-newyork-2026-03')!, newyorkZones),

  // Philadelphia Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-philadelphia-2026-01')!, philadelphiaZones),
  // Philadelphia Feb - zones 11, 12 issue (rejected)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-philadelphia-2026-02')!, philadelphiaZones, { issueZoneNumbers: [11, 12] }),
  // Philadelphia Mar - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-philadelphia-2026-03')!, philadelphiaZones),

  // Hartford Jan - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-hartford-2026-01')!, hartfordZones),
  // Hartford Feb - all tested
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-hartford-2026-02')!, hartfordZones),
  // Hartford Mar - zone 14 not tested (draft, faulty sensor)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-hartford-2026-03')!, hartfordZones, { notTestedZoneNumbers: [14] }),

  // Nashville Feb r2 - all tested (rejected for missing attachment)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-02-r2')!, nashvilleZones),
  // Nashville Feb s3 - all tested (submitted)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-02-s3')!, nashvilleZones),

  // Philadelphia Feb s2 - all tested (resubmission)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-philadelphia-2026-02-s2')!, philadelphiaZones),

  // Atlanta Mar d2 - all tested (draft re-test)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-atlanta-2026-03-d2')!, atlantaZones),

  // Milwaukee Mar d2 - first 5 zones tested (draft, in progress)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-milwaukee-2026-03-d2')!, milwaukeeZones, { notTestedZoneNumbers: [6, 7, 8, 9, 10] }),

  // Nashville Feb a3 - all tested (approved final)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-nashville-2026-02-a3')!, nashvilleZones),

  // Philadelphia Feb a2 - all tested (approved re-test)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-philadelphia-2026-02-a2')!, philadelphiaZones),

  // Madison Feb a2 - all tested (approved re-test)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-madison-2026-02-a2')!, madisonZones),

  // Charlotte Jan r1 - zone 11 not tested (rejected)
  ...generateTestZoneResults(ALARM_TESTS.find((t) => t.id === 'test-charlotte-2026-01-r1')!, charlotteZones, { notTestedZoneNumbers: [11] }),
];

// ---------------------------------------------------------------------------
// Biannual Checks (24 records: 2 check types x 12 buildings)
// ---------------------------------------------------------------------------

export const BIANNUAL_CHECKS: BiannualCheck[] = [
  // Wausau
  { id: 'bi-wausau-cell', buildingId: 'bld-wausau', checkType: 'CELLULAR_BACKUP', checkDate: '2025-12-15', nextDueDate: '2026-06-15', checkedBy: 'u-terri', checkedByName: 'Terri Serrano', status: 'COMPLIANT', evidencePath: '/reports/biannual/wausau_cellular_dec2025.pdf', notes: 'Cellular backup test successful. Signal strength nominal.' },
  { id: 'bi-wausau-cam', buildingId: 'bld-wausau', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-01', nextDueDate: '2026-03-31', checkedBy: 'u-karen', checkedByName: 'Karen Davis', status: 'COMPLIANT', evidencePath: '/reports/biannual/wausau_camera_mar2026.pdf', notes: 'All 8 cameras recording and backed up to cloud.' },

  // Madison
  { id: 'bi-madison-cell', buildingId: 'bld-madison', checkType: 'CELLULAR_BACKUP', checkDate: '2025-11-20', nextDueDate: '2026-05-20', checkedBy: 'u-terri', checkedByName: 'Terri Serrano', status: 'COMPLIANT', evidencePath: '/reports/biannual/madison_cellular_nov2025.pdf' },
  { id: 'bi-madison-cam', buildingId: 'bld-madison', checkType: 'CAMERA_BACKUP', checkDate: '2026-02-28', nextDueDate: '2026-03-30', checkedBy: 'u-terri', checkedByName: 'Terri Serrano', status: 'COMPLIANT', evidencePath: '/reports/biannual/madison_camera_feb2026.pdf' },

  // Milwaukee
  { id: 'bi-milwaukee-cell', buildingId: 'bld-milwaukee', checkType: 'CELLULAR_BACKUP', checkDate: '2025-10-10', nextDueDate: '2026-04-10', checkedBy: 'u-karen', checkedByName: 'Karen Davis', status: 'COMPLIANT', evidencePath: '/reports/biannual/milwaukee_cellular_oct2025.pdf' },
  { id: 'bi-milwaukee-cam', buildingId: 'bld-milwaukee', checkType: 'CAMERA_BACKUP', checkDate: '2026-02-15', nextDueDate: '2026-03-17', checkedBy: 'u-karen', checkedByName: 'Karen Davis', status: 'NON_COMPLIANT', notes: 'Camera 3 (warehouse north) not recording. Work order submitted for repair.' },

  // Chicago
  { id: 'bi-chicago-cell', buildingId: 'bld-chicago', checkType: 'CELLULAR_BACKUP', checkDate: '2025-12-01', nextDueDate: '2026-06-01', checkedBy: 'u-terri', checkedByName: 'Terri Serrano', status: 'COMPLIANT', evidencePath: '/reports/biannual/chicago_cellular_dec2025.pdf', notes: 'Checked before renovation started.' },
  { id: 'bi-chicago-cam', buildingId: 'bld-chicago', checkType: 'CAMERA_BACKUP', checkDate: '2026-01-05', nextDueDate: '2026-02-04', checkedBy: 'u-karen', checkedByName: 'Karen Davis', status: 'PENDING', notes: 'Camera system offline due to HVAC renovation. Check deferred.' },

  // Atlanta
  { id: 'bi-atlanta-cell', buildingId: 'bld-atlanta', checkType: 'CELLULAR_BACKUP', checkDate: '2026-01-15', nextDueDate: '2026-07-15', checkedBy: 'u-sarah', checkedByName: 'Sarah Thompson', status: 'COMPLIANT', evidencePath: '/reports/biannual/atlanta_cellular_jan2026.pdf' },
  { id: 'bi-atlanta-cam', buildingId: 'bld-atlanta', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-05', nextDueDate: '2026-04-04', checkedBy: 'u-robert', checkedByName: 'Robert Taylor', status: 'COMPLIANT', evidencePath: '/reports/biannual/atlanta_camera_mar2026.pdf' },

  // Charlotte
  { id: 'bi-charlotte-cell', buildingId: 'bld-charlotte', checkType: 'CELLULAR_BACKUP', checkDate: '2025-11-01', nextDueDate: '2026-05-01', checkedBy: 'u-sarah', checkedByName: 'Sarah Thompson', status: 'COMPLIANT', evidencePath: '/reports/biannual/charlotte_cellular_nov2025.pdf' },
  { id: 'bi-charlotte-cam', buildingId: 'bld-charlotte', checkType: 'CAMERA_BACKUP', checkDate: '2026-02-20', nextDueDate: '2026-03-22', checkedBy: 'u-sarah', checkedByName: 'Sarah Thompson', status: 'PENDING', notes: 'Camera backup verification scheduled for next week.' },

  // Nashville
  { id: 'bi-nashville-cell', buildingId: 'bld-nashville', checkType: 'CELLULAR_BACKUP', checkDate: '2025-12-20', nextDueDate: '2026-06-20', checkedBy: 'u-robert', checkedByName: 'Robert Taylor', status: 'COMPLIANT', evidencePath: '/reports/biannual/nashville_cellular_dec2025.pdf' },
  { id: 'bi-nashville-cam', buildingId: 'bld-nashville', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-10', nextDueDate: '2026-04-09', checkedBy: 'u-robert', checkedByName: 'Robert Taylor', status: 'COMPLIANT', evidencePath: '/reports/biannual/nashville_camera_mar2026.pdf' },

  // Jacksonville (closed)
  { id: 'bi-jacksonville-cell', buildingId: 'bld-jacksonville', checkType: 'CELLULAR_BACKUP', checkDate: '2025-09-15', nextDueDate: '2026-03-15', checkedBy: 'u-robert', checkedByName: 'Robert Taylor', status: 'NON_COMPLIANT', notes: 'Facility closed. Alarm system decommissioned.' },
  { id: 'bi-jacksonville-cam', buildingId: 'bld-jacksonville', checkType: 'CAMERA_BACKUP', checkDate: '2025-11-10', nextDueDate: '2025-12-10', checkedBy: 'u-robert', checkedByName: 'Robert Taylor', status: 'NON_COMPLIANT', notes: 'Facility closed. Camera system powered down.' },

  // Boston
  { id: 'bi-boston-cell', buildingId: 'bld-boston', checkType: 'CELLULAR_BACKUP', checkDate: '2026-02-01', nextDueDate: '2026-08-01', checkedBy: 'u-lisa', checkedByName: 'Lisa Martinez', status: 'COMPLIANT', evidencePath: '/reports/biannual/boston_cellular_feb2026.pdf' },
  { id: 'bi-boston-cam', buildingId: 'bld-boston', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-12', nextDueDate: '2026-04-11', checkedBy: 'u-jennifer', checkedByName: 'Jennifer Anderson', status: 'COMPLIANT', evidencePath: '/reports/biannual/boston_camera_mar2026.pdf' },

  // New York
  { id: 'bi-newyork-cell', buildingId: 'bld-newyork', checkType: 'CELLULAR_BACKUP', checkDate: '2026-01-20', nextDueDate: '2026-07-20', checkedBy: 'u-lisa', checkedByName: 'Lisa Martinez', status: 'COMPLIANT', evidencePath: '/reports/biannual/newyork_cellular_jan2026.pdf' },
  { id: 'bi-newyork-cam', buildingId: 'bld-newyork', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-08', nextDueDate: '2026-04-07', checkedBy: 'u-lisa', checkedByName: 'Lisa Martinez', status: 'NON_COMPLIANT', notes: 'Camera 12 (Floor 2 hallway) has intermittent recording failures. Replacement ordered.' },

  // Philadelphia
  { id: 'bi-philadelphia-cell', buildingId: 'bld-philadelphia', checkType: 'CELLULAR_BACKUP', checkDate: '2025-10-25', nextDueDate: '2026-04-25', checkedBy: 'u-jennifer', checkedByName: 'Jennifer Anderson', status: 'COMPLIANT', evidencePath: '/reports/biannual/philadelphia_cellular_oct2025.pdf' },
  { id: 'bi-philadelphia-cam', buildingId: 'bld-philadelphia', checkType: 'CAMERA_BACKUP', checkDate: '2026-02-10', nextDueDate: '2026-03-12', checkedBy: 'u-jennifer', checkedByName: 'Jennifer Anderson', status: 'PENDING', notes: 'Awaiting IT confirmation that backup storage is operational after server migration.' },

  // Hartford
  { id: 'bi-hartford-cell', buildingId: 'bld-hartford', checkType: 'CELLULAR_BACKUP', checkDate: '2026-01-05', nextDueDate: '2026-07-05', checkedBy: 'u-lisa', checkedByName: 'Lisa Martinez', status: 'COMPLIANT', evidencePath: '/reports/biannual/hartford_cellular_jan2026.pdf' },
  { id: 'bi-hartford-cam', buildingId: 'bld-hartford', checkType: 'CAMERA_BACKUP', checkDate: '2026-03-15', nextDueDate: '2026-04-14', checkedBy: 'u-jennifer', checkedByName: 'Jennifer Anderson', status: 'COMPLIANT', evidencePath: '/reports/biannual/hartford_camera_mar2026.pdf', notes: 'All 6 cameras verified. Cloud backup retention set to 90 days.' },
];
