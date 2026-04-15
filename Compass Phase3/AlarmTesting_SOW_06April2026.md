# Statement of Work

**SOW 04/06/2026**

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Engagement Objectives](#engagement-objectives)
3. [Scope of Work](#scope-of-work)
4. [Out of Scope](#out-of-scope)
5. [Assumptions & Client Dependencies](#assumptions-client-dependencies--pre-requisites)
6. [Risk Management Approach](#risk-management-approach)
7. [Tentative Timelines](#tentative-timelines)
8. [Project Deliverables & Acceptance Criteria](#project-deliverables-and-acceptance-criteria)
9. [Support & Warranty](#support-and-warranty)
10. [Cost Estimates](#cost-estimates)
11. [Invoicing](#invoicing)
12. [Contact Information](#contact-information)
13. [Terms & Conditions](#terms--conditions)
14. [Confidentiality & Ownership](#confidentiality--ownership)
15. [Acceptance & Sign-Off](#acceptance--sign-off)

---

## STATEMENT OF WORK

This Statement of Work ("SOW") is between Compass Group ("Compass") and Damco Solutions Inc. ("Damco"), is effective as of April 6, 2026 (the "Effective Date").

Subject to the terms of this Statement of Work, Client and Damco agree to the following:

---

## Background & Context

Compass Group currently manages alarm system testing and compliance across multiple building locations through a combination of manual processes, paper-based logs, and ad-hoc email communications. On-site managers are required to conduct monthly alarm zone tests for each building and submit biannual cellular backup and camera backup verification checks — all governed by security company SLA requirements.

This manual approach presents several challenges including:

- **Limited visibility** — Regional Controllers and DGMs have no centralized dashboard to monitor which buildings are compliant, pending, or overdue for their monthly alarm tests
- **Inconsistent record-keeping** — Test results are maintained in scattered spreadsheets and paper forms, making it difficult to produce audit-ready compliance reports
- **No formal approval workflow** — Test submissions rely on informal email exchanges between testers and approvers with no structured review, rejection, or resubmission process
- **Missed deadlines** — Without automated escalation, overdue buildings are often not identified until after compliance audit windows have closed
- **No biannual tracking** — Cellular backup and 30-day camera backup verification checks lack a centralized tracking mechanism with due-date alerting
- **Manual reporting** — Generating per-building or per-region compliance reports requires significant manual effort and is prone to errors

This Statement of Work proposes a comprehensive module — integrated into the existing Compass Cashroom Compliance System infrastructure — to digitize and streamline the alarm testing compliance process, making it efficient, accurate, and audit-ready.

---

## Engagement Objectives

The primary objective of this engagement is to design, develop, and deploy an **Alarm Testing Compliance Module** that digitizes and streamlines the monthly alarm testing process, biannual compliance checks, and associated approval workflows across all building locations.

### Key Deliverables

- Zone-by-zone digital alarm test form with auto-save, draft management, and file upload for security company reports
- Structured approval workflow with review, approve, reject, and resubmit capabilities
- Auto-escalation engine for overdue tests with configurable tier-based notifications (email + in-app)
- Biannual compliance check tracking for cellular backup and 30-day camera backup verification
- Compliance dashboard with real-time KPIs, 12-month trend charts, and building-level drill-downs
- Downloadable compliance reports (CSV + PDF) per building and per region
- Administrative portal for building configuration, zone management, compliance rules, user access, and audit trail
- Role-based access for Testers (Controllers/DGMs), Approvers (Regional Controllers), and Administrators

### Expected Outcomes

- **100% digitization** of monthly alarm test submissions and biannual checks
- **Elimination of missed deadlines** through automated escalation tiers with configurable thresholds
- **Real-time compliance visibility** for management via dashboards and trend analytics
- **Faster approval cycles** with structured review workflows and rejection/resubmission flow
- **Complete audit readiness** with immutable audit trail logging all key actions
- **Reduced administrative overhead** through CSV import for buildings, zones, and user access assignments
- **Scalable foundation** for additional compliance modules and integration with the existing Cashroom system

---

## Scope of Work

### Screen Inventory

The Alarm Testing Compliance Module comprises 16 screens across 4 user contexts:

| # | Screen | User Context | Purpose |
|---|--------|-------------|---------|
| 1 | Alarm Test Form | Tester | Zone-by-zone monthly alarm test with auto-save and file upload |
| 2 | Alarm Upload | Tester | Dedicated file upload for security company reports |
| 3 | Alarm Test History | Tester | View all past tests with filters, continue drafts, view completed tests |
| 4 | Biannual Checks | Tester | Record cellular backup and camera backup verification checks |
| 5 | Alarm Approvals | Approver | Review queue with status tabs, region filter, and escalation access |
| 6 | Alarm Review | Approver / Tester | Detailed test review with zone results, compliance checks, approve/reject |
| 7 | Escalation | Approver | Overdue buildings list with tier badges and send reminder action |
| 8 | Alarm Compliance Dashboard | Management | KPIs, 12-month trend chart, building compliance table, export reports |
| 9 | Alarm Trends | Management | Historical compliance analytics, approval turnaround, recurring issues |
| 10 | Building Drill-Down | Management | Single building deep dive: zones, test history, biannual, timeline |
| 11 | Biannual Status | Management | All buildings' cellular and camera compliance in one view |
| 12 | Zone Configuration | Admin | Add, edit, deactivate, delete, import zones per building |
| 13 | Building Setup | Admin | Add, edit, import, reset buildings with security company details |
| 14 | Compliance Rules | Admin | Monthly deadlines, escalation tiers, biannual config, notifications |
| 15 | User Access | Admin | Grant/revoke tester and approver access with CSV import |
| 16 | Alarm Audit Trail | Admin | Chronological log of all key actions with filters and CSV export |

### Functional Requirements

#### 1. User Channels and Access

- Web-based application integrated into the existing Compass Compliance System (shared infrastructure with existing Cashroom system)
- Role-based access control with the following alarm-specific roles:
  - **Tester** (Controller / DGM) — conducts monthly alarm tests and biannual checks
  - **Approver** (Regional Controller / Admin) — reviews, approves, or rejects submitted tests
  - **Administrator** — manages buildings, zones, compliance rules, user access, and audit trail
- Single user directory shared with the main application (no separate alarm user management)
- User access grants managed exclusively by Administrators

#### 2. Monthly Alarm Test Submission

- Digital alarm test form for conducting zone-by-zone monthly alarm testing per building
- Building selector with security company information display (company name, customer ID, phone)
- Zone testing checklist grouped by zone type (Entry/Exit, Interior Motion, Panic/Silent, Hold-Up, Fire/Smoke, Other)
- Three-state zone marking: Tested / Not Tested / Issue Found — with optional per-zone notes
- Real-time progress bar and zone count summary
- File upload for alarm company Customer Activity Report (PDF/Excel, up to 25MB)
- Auto-save with debounced timer (1-second delay) persisting zone results, metadata, and attachments
- Manual Save Draft functionality with timestamp display
- Submit for Approval with validation warnings for unmarked or Not Tested zones
- **Duplicate submission prevention** — blocks new test when building already has a SUBMITTED or APPROVED test for the current month
- Draft and rejected test restoration — auto-loads previous state (zones, dates, notes, files) when selecting a building

#### 3. Rejection and Resubmission Flow

- Rejection notification banners on tester home screen showing building name, month, and rejection reason
- "Fix & Resubmit" action that reopens the rejected test as a draft with all zone results and attachments preserved
- Tester edits only the failing zones and resubmits — no need to start from scratch
- Multiple rejection/resubmission cycles supported

#### 4. Biannual Compliance Checks

- Separate screen for recording biannual cellular backup and camera backup verifications
- Two independent side-by-side cards per building:
  - **Cellular Backup Test** — date, Pass/Fail result, notes, evidence upload
  - **30-Day Camera Backup** — date, days of backup verified (with 30-day threshold indicator), Pass/Fail, notes, evidence upload
- Last check info display with status dot (green/red/gray), check date, checked by, next due date
- **Duplicate check prevention** — compliant checks with future due dates block the form; overdue or non-compliant allows new check
- Independent blocking per check type (cellular can be blocked while camera is open)
- Next due date auto-calculated as check date + 6 months
- Check history table with type badges (Cellular = blue, Camera = purple), pagination

#### 5. Approval Workflow

- Alarm Approvals screen accessible to Regional Controllers and Administrators
- Status filter tabs: All / Pending / Approved / Rejected — with count badges
- Region filter dropdown and sort toggle (Oldest/Newest)
- Unified test table with context-adaptive columns (waiting time for pending, date for approved, reason for rejected)
- Detailed review screen with:
  - Zone-by-zone results in read-only mode with color-coded borders (red = Not Tested, amber = Issue)
  - Compliance verification auto-checks (all zones tested, report uploaded, test within month, no unresolved issues)
  - Attached reports with download capability
  - Approve / Reject actions with reviewer notes
  - Rejection requires mandatory reason; notification sent to tester and approver
- **Role-based action visibility** — Approve/Reject buttons visible only to Regional Controllers and Admins, not to Testers viewing the review screen

#### 6. Auto-Escalation Engine

- Configurable 3-tier escalation for overdue monthly tests:
  - **Tier 1 (Reminder)** — X days before deadline → notifies Tester
  - **Tier 2 (Deadline)** — X days after deadline → notifies Tester + Approver
  - **Tier 3 (Critical)** — X days after deadline → notifies Tester + Approver + Regional Controller
- Configurable 3-tier escalation for overdue biannual checks:
  - Tier 1 → Tester + Approver
  - Tier 2 → Tester + Approver + Regional
  - Tier 3 → Tester + Approver + Regional + DGM
- Escalation screen showing overdue buildings with tier badges, days overdue, and "Send Reminder" action with tier-specific recipients
- Dashboard shows auto-escalation tier indicators (T1/T2/T3 badges) on overdue buildings with hover tooltips and legend

#### 7. Notifications

- **Email notifications** for escalations and status changes (configurable toggle)
- **In-app notifications** including rejection banners on tester home screen (configurable toggle)
- Notification settings managed via Compliance Rules admin screen

#### 8. Compliance Dashboard and Reporting

- **Alarm Compliance Dashboard** (management view) with:
  - 5 KPI cards: Compliance Rate, Compliant, Pending Review, Overdue, Exempt
  - KPI cards clickable to filter the building table
  - 12-month rolling compliance trend chart (area chart with 80% target reference line)
  - Biannual compliance cards: Cellular Backup card (X/Y compliant) and Camera Backup card (X/Y compliant) displayed side by side
  - Building compliance table with columns: Status (traffic light + escalation badge), Building, Region, Testers, Approver, Last Test, Zones (mini bar), Cellular, Camera, Actions
  - Sortable columns, search filter, pagination
  - Escalation legend below table when overdue buildings exist
- **Export Compliance Reports**:
  - Per Building Report — CSV or PDF with building-level compliance data
  - Per Region Report — CSV or PDF with aggregated region-level summary
  - Exports respect active month and region filters
- **Alarm Trends** page with compliance trend, approval turnaround chart, recurring issues table, and CSV export
- **Building Drill-Down** with zone configuration, 12-month test history grid, biannual compliance, approval timeline
- **Biannual Status** page showing all buildings' cellular and camera status with color-coded cells

#### 9. Test History

- Alarm Test History screen with:
  - 4 KPI cards: Tests This Year, Approved, Pending Review, Rejected (with tooltips)
  - Filters: Building dropdown, Status pills (All/Draft/Submitted/Approved/Rejected), Year dropdown, Month dropdown
  - Year + month filter logic: year only = full year, year + month = exact month match
  - Month dropdown disabled when no year selected; year change resets month
  - Table with building name, test date, month, tester, zones summary bar, status badge, actions
  - "Continue" button (green) for DRAFT tests — navigates to test form with full state restoration
  - "View" button for non-draft tests — navigates to read-only review screen
  - Sorted by date descending, paginated (10 per page)

#### 10. Administrative Configuration

- **Building Setup**: Add, edit, import (CSV), reset buildings. Fields: name, region, security company, customer ID, phone, status, assigned testers, assigned approver. Sample CSV download.
- **Zone Configuration**: Add, edit, deactivate, delete, import (CSV) zones per building. Fields: zone number, name, type, area number. Grouped display.
- **Compliance Rules**: Monthly deadline day, approval SLA days, requirement toggles (all zones tested, report upload, approver sign-off), escalation tiers (monthly + biannual), notification settings (email + in-app toggles)
- **User Access**: Grant/revoke tester or approver access. Building-level assignment with checkbox list. Import CSV with sample download. Filter by All/Testers/Approvers + search.
- **Alarm Audit Trail**: Standalone screen (separate from the Cashroom Audit Trail). Logs: access grants/revokes, building changes, test submissions/approvals/rejections, rule updates, escalation events. Category filters, search, date range, CSV export. Paginated (15 per page).

### Non-Functional Requirements

#### Performance

- API response time < 5 seconds for standard operations
- Dashboard loading < 3 seconds with 12-month chart data
- Report generation (CSV/PDF) < 10 seconds
- Support for concurrent usage by 100+ users

#### Scalability

- Leverages existing serverless infrastructure (auto-scaling)
- Support for 500+ buildings with 50+ zones each
- Database design optimized for 12-month rolling history queries

#### Availability and Reliability

- Target availability: 99% during business hours
- Shared infrastructure with existing system (multi-AZ deployment)
- Idempotency controls to prevent duplicate test submissions

#### Security

- Shared authentication with existing system (JWT-based)
- Role-based access control enforced at API and UI levels
- Encryption in transit and at rest (AWS KMS)
- Approve/Reject actions restricted to authorized roles only
- Input validation and sanitization on all form submissions

#### Usability

- Intuitive zone-by-zone testing interface with progress indicators
- Auto-save to prevent data loss during testing
- Rejection banners with one-click "Fix & Resubmit" flow
- Disabled buttons visually faded (40% opacity) with not-allowed cursor
- Responsive layout for standard desktop screens

#### Maintainability

- Modular component architecture (shared with existing Cashroom codebase)
- Consistent design system (CSS custom properties, DM Serif Display + DM Sans fonts)
- Mock-backed API layer for independent frontend development and testing

#### Compliance

- Immutable audit trail for all alarm testing actions
- Complete traceability of who tested, who approved, when, and what changed
- Configurable data retention aligned with existing Cashroom policies
- Exportable compliance reports for external auditors

---

## Out of Scope

The following items are explicitly out of scope for this phase and may be considered for future phases:

- Integration with external security company systems or alarm monitoring platforms
- Automated alarm zone discovery or import from security company APIs
- Push notifications / SMS alerting (email and in-app only for this phase)
- Mobile native applications (iOS/Android) — web-based only
- Integration with facility management or property management systems
- Automated scheduling of alarm tests (testers initiate manually)
- Video evidence capture or live camera feed integration
- Multi-language support
- Offline mode for field testing without internet connectivity
- Historical data migration from existing paper/Excel records

---

## Assumptions, Client Dependencies & Pre-requisites

### Project Assumptions

- Existing Cashroom Compliance System infrastructure (AWS, authentication, database) is operational and available for extension
- Client will provide a complete master list of buildings with assigned testers and approvers within 5 business days of project kickoff
- Security company details (name, customer ID, phone) per building will be provided or entered by admin during setup
- Alarm zone configurations per building will be provided via CSV or entered manually by admin
- Escalation thresholds and compliance rule defaults will be finalized during Week 1
- Email infrastructure (SES) from existing Cashroom system is available for alarm notification emails
- All users have access to modern web browsers (Chrome, Firefox, Safari, Edge)
- The existing user directory from the Cashroom system will be shared — no separate user provisioning needed

### Client Dependencies

- Timely provision of building master data, zone configurations, and tester/approver assignments
- Designation of primary business stakeholder (Shivani) for decision-making and approvals
- Availability of 3-5 end users (testers + approvers) for UAT participation
- Timely feedback and sign-off on deliverables within 2 business days
- Confirmation of escalation tier thresholds and notification preferences
- Decision on any remaining open questions (Q6, Q7, Q9, Q10 — see appendix)

### Dependencies & Prerequisites

- Existing Cashroom backend services running and accessible
- AWS environment (dev, staging, production) provisioned and accessible
- SES domain verification completed (from existing Cashroom system setup)
- User accounts created in the shared user directory

---

## Risk Management Approach

| # | Risk | Impact | Probability | Mitigation Strategy |
|---|------|--------|-------------|---------------------|
| 1 | Building/zone data not available on time | High | Medium | Provide CSV templates with sample data early; admin can import incrementally |
| 2 | Escalation threshold disagreements | Medium | Medium | Finalize in Week 1 workshop; defaults provided; admin can adjust post-deployment |
| 3 | User adoption resistance from testers | High | Medium | Intuitive zone-by-zone UI; auto-save; draft restoration; minimal training needed |
| 4 | Scope creep during development | High | High | Formal change control; clearly defined scope; open questions deferred |
| 5 | Existing infrastructure changes | High | Low | Modular architecture; shared API layer with clear boundaries |
| 6 | Security company report format variations | Medium | Medium | Accept PDF/Excel generically; no format parsing required |
| 7 | Email deliverability for escalations | High | Medium | Leverage existing SES setup; test with actual approver emails early |
| 8 | Zone configuration complexity | Medium | Low | CSV import with validation; sample CSV provided; admin can edit on UI |

### Risk Monitoring and Reporting

- Weekly risk review meetings with stakeholders
- Risk register maintained and updated throughout project lifecycle
- Immediate escalation protocol for critical risks

---

## Tentative Timelines

### Week 1: Foundation and Design

**Focus:** Requirements finalization, building/zone data onboarding, and core screen development

- Finalize open questions (Q6, Q7, Q9, Q10) with Shivani
- Confirm escalation thresholds, notification preferences, and compliance rule defaults
- Building and zone CSV import templates finalized
- Core tester screens: Alarm Test Form, Zone Checklist, File Upload, Draft/Submit flow (Screens 1, 2)
- Biannual Checks screen — Cellular + Camera (Screen 4)
- Alarm Test History with filters and draft continuation (Screen 3)

**Week 1 Milestone:** Tester can select a building, mark zones, upload report, save draft, and submit for approval. Biannual checks recordable.

### Week 2: Approval Workflow and Dashboard

**Focus:** Build approval workflow and management dashboards

- Alarm Approvals screen with status tabs, review, approve, reject (Screens 5, 6)
- Rejection/resubmission flow with notification banners
- Escalation screen with tier-based send reminder (Screen 7)
- Alarm Compliance Dashboard with KPIs, trend chart, building table, export reports (Screen 8)
- Alarm Trends, Building Drill-Down, and Biannual Status pages (Screens 9, 10, 11)

**Week 2 Milestone:** Complete end-to-end flow from test submission through approval/rejection. Dashboard shows real-time compliance status. Reports exportable.

### Week 3: Admin, Integration and Hardening

**Focus:** Administrative screens, backend integration, audit trail, and quality assurance

- Building Setup with CSV import/reset (Screen 13)
- Zone Configuration with CSV import (Screen 12)
- Compliance Rules — monthly, escalation, biannual, notifications (Screen 14)
- User Access with CSV import (Screen 15)
- Alarm Audit Trail — standalone screen with CSV export (Screen 16)
- Auto-escalation engine integration with email notifications
- End-to-end testing of all 16 screens (409+ test cases documented)
- Security review and role-based access verification

**Week 3 Milestone:** All 16 screens functional. Admin can configure buildings, zones, rules, and access. Audit trail operational. Escalation engine active.

### Week 4: UAT and Go-Live

**Focus:** User acceptance testing and production deployment

- UAT with testers (Controllers/DGMs), approvers (Regional Controllers), and admin users
- Bug fixes and refinements based on UAT feedback
- Performance testing and optimization
- Production deployment and post-deployment validation
- Knowledge transfer to client IT team
- Go-live support commencement (5 business days)

**Week 4 Milestone:** UAT sign-off received. Production deployment successful. Go-live support active.

---

## Project Deliverables and Acceptance Criteria

### Technical Deliverables

- Fully functional Alarm Testing Compliance Module deployed on AWS (16 screens)
- Integration with existing Cashroom system authentication and user directory
- Auto-escalation engine with configurable tiers
- Email and in-app notification system
- CSV import/export functionality for buildings, zones, user access, and compliance reports

### Documentation Deliverables

- User Guide covering all 16 screens with step-by-step instructions
- Admin Configuration Guide (buildings, zones, rules, access)
- Demo Guide with login credentials and screen-by-screen walkthrough
- Technical Documentation (API endpoints, data models, architecture)

### Training Deliverables

- End-user training sessions (Testers, Approvers, Admin)
- Recorded training videos for future reference

### Acceptance Criteria

The project will be considered complete when the following criteria are met:

- All 16 alarm screens are implemented and functional as specified
- Monthly test submission, draft, and submit flows work end-to-end
- Rejection/resubmission flow works with full state restoration (zones, dates, notes, files)
- Biannual check recording with duplicate prevention works correctly for both cellular and camera independently
- Approval workflow with role-based access control is verified (approve/reject only visible to RC and Admin)
- Auto-escalation engine triggers correctly based on configured thresholds with tier-specific recipients
- Compliance dashboard shows accurate KPIs, 12-month trend data, and building status with tester/approver visibility
- CSV import works for buildings, zones, and user access with validation and sample templates
- Export reports (CSV/PDF) generate correctly per building and per region, respecting active filters
- Audit trail logs all key actions with category filtering, date range, search, and CSV export
- Duplicate submission prevention blocks same-building same-month tests (SUBMITTED and APPROVED)
- Email and in-app notifications deliver correctly with configurable toggles
- All non-functional requirements (performance, security, availability) are verified
- UAT is successfully completed with sign-off from business stakeholders
- Security review checklist is completed with no critical vulnerabilities
- All documentation is delivered and approved
- Training sessions are conducted and recorded
- Production deployment is successful with post-deployment validation
- Go-live support period (5 business days) is completed
- Knowledge transfer to client IT team is completed

---

## Support and Warranty

### Go-Live Support

Damco will provide intensive support for 5 business days following production go-live, including:

- Dedicated support team available during business hours
- Rapid response to production issues (response time < 2 hours for critical issues)
- Bug fixes for any defects discovered during go-live period
- User support for questions and assistance
- Monitoring and proactive issue detection

### Warranty Period

A 15-day warranty period will commence after successful go-live, covering:

- Bug fixes for defects in delivered functionality
- Corrections to documentation errors
- Performance issues related to code quality
- Resolution of issues identified during UAT but not yet fixed

**Note:** Warranty does not cover issues arising from changes to requirements, infrastructure modifications, or usage beyond specified capacity. New feature requests will be handled through a separate change request process.

### Optional Ongoing Support

Post-warranty ongoing support and maintenance can be arranged through a separate agreement, including:

- Application monitoring and maintenance
- Bug fixes and minor enhancements
- AWS infrastructure optimization
- Monthly health checks and reporting
- Priority support with defined SLAs

---

## Cost Estimates

### Development Cost (Fixed Price)

Based on the 4-week scope with a dedicated team, leveraging existing Cashroom system infrastructure:

| # | Services | Cost (USD) |
|---|----------|-----------|
| 1 | Alarm Testing Compliance Module (16 screens) | $ X,XXX |
| 2 | 1 Week Hyper Care Support | $ 0 |
| **Total** | | **$ X,XXX** |

### Payment Terms

Proposed payment schedule:

| # | Milestones | Distribution |
|---|-----------|-------------|
| 1 | Contract Sign-off | 30% |
| 2 | Completion of Week 2 milestone (core functionality + approval workflow demo) | 40% |
| 3 | UAT sign-off | 20% |
| 4 | Successful production go-live | 10% |

### Notes

- This cost is exclusive of any taxes or duties, if applicable at any time
- This cost is for solution implementation only; infrastructure costs are covered under the existing Cashroom SOW
- All resources will be operating remotely from India
- Any travel or other work-related expense will be pre-approved and billed to Client on actuals
- Offshore resources will work from 10:30 AM IST to 7:00 PM IST (unless otherwise specified)

---

## Invoicing

Damco shall raise invoices in accordance with the payment milestones defined in the Payment Milestones section of this Statement of Work.

All invoices shall be issued in United States Dollars (USD) and are payable within fifteen (15) calendar days from the invoice date, unless otherwise agreed in writing.

Payments shall be made via wire transfer or check payable to Damco Solutions Inc., as per the banking details specified on the invoice.

All fees quoted under this Statement of Work are exclusive of applicable taxes, duties, or governmental levies. Any such taxes, if applicable, shall be borne by the Client in accordance with prevailing laws and regulations.

---

## Contact Information

| # | Party | Name | Designation | Contact |
|---|-------|------|-------------|---------|
| 1 | Compass Group | Shivani Gupta | Finance - VP | Shivani.Gupta@compass-usa.com |
| 2 | Damco | Manish Gupta | Technology - VP | manishg4@Damcogroup.com |

---

## Terms & Conditions

### Change Management

Any changes to the scope, requirements, or deliverables after project commencement will follow a formal change control process:

- Change requests must be submitted in writing
- Impact assessment will be provided within 2 business days
- Changes may affect timeline and cost
- Approved changes will be documented with revised estimates
- Client authorization required before implementing scope changes

---

## Confidentiality & Ownership

Damco acknowledges and agrees that all information concerning Client Application and data is "Confidential and Proprietary Information". Damco undertakes that it will not permit the duplication and disclosure of any such Confidential and Proprietary information, pertaining to Client, to any person other than to personnel who require such information for the performance of their obligations covered by this SOW.

Client acknowledges and agrees that all information concerning Damco's business is "Confidential and Proprietary Information". Client undertakes that it will not permit the duplication and disclosure of any such Confidential and Proprietary information, pertaining to Damco, to any person other than to personnel who require such information for the performance of their obligations covered by this SOW.

Damco's total aggregate liability in contract, tort (including negligence and breach of statutory duty howsoever arising), misrepresentation (whether innocent or negligent), restitution or otherwise, arising in connection with the performance or contemplated performance of the services under this SOW or any collateral contract thereto shall be limited to the total amount of charges paid by the Client and received by the Damco under this SOW.

---

## Acceptance & Sign-Off

IN WITNESS WHEREOF, the parties have caused this Statement of Work (SOW) to be executed by their duly authorized representatives as of the date written below:

| | Damco Solutions Inc. | Compass Group |
|---|---|---|
| Signature | | |
| Name | | Shivani Gupta |
| Title | | Finance, VP |
| Date | | |

---

## Appendix A: Client Decision Log

The following questions were raised during requirements analysis and answered by Shivani Gupta:

| # | Question | Answer | Impact |
|---|----------|--------|--------|
| Q1 | Are alarm users the same directory as main app users? | Yes, same directory | Shared user management; `listAlarmUsers()` wraps main USERS |
| Q2 | Who can grant/revoke alarm access? | Admin only | Access panel restricted to admin role |
| Q3 | Who enters security company details? | Admin only, via Add Building form or CSV import | No external integration needed |
| Q4 | What happens when a test is overdue? | Auto-escalation | 3-tier auto-escalation engine with configurable thresholds |
| Q5 | How are testers assigned to buildings? | Import from Excel/CSV, then edit on UI | CSV import + manual edit on User Access screen |
| Q8 | Email or in-app notifications? | Both | Configurable toggles in Compliance Rules |
| Q11 | Need downloadable compliance reports? | Yes, both PDF and Excel, per building AND per region | Export buttons on Compliance Dashboard |
| Q12 | Compliance history duration? | Rolling 12 months | Extended from 6 to 12 months in dashboard and trends |
| Q13 | Need audit trail? | Yes | Standalone Alarm Audit Trail screen with CSV export |

## Appendix B: Open Questions (Pending Shivani's Confirmation)

| # | Question | Status | Assumed Default |
|---|----------|--------|-----------------|
| Q6 | Can a building have multiple tests in the same month (re-tests after rejection)? | Pending | Currently blocked; rejected tests are edited and resubmitted (same test record) |
| Q7 | What is the approval SLA — how many days before it escalates? | Pending | Configurable via admin; default 5 days |
| Q9 | Are there different zone types that need different test procedures? | Pending | Currently all zone types follow the same Tested/Not Tested/Issue workflow |
| Q10 | Should biannual checks be linked to monthly tests or independent? | Pending | Currently independent — biannual checks are a separate screen and workflow |

**Note:** These questions have working defaults in the current implementation. Final decisions may require minor adjustments but will not impact the overall architecture.

## Appendix C: Test Coverage

Comprehensive end-to-end test cases have been documented for quality assurance:

| Screen | Test Cases |
|--------|-----------|
| Screen 1: Alarm Test Form | 139 |
| Screen 3: Alarm Test History | 124 |
| Screen 4: Biannual Checks | 146 |
| Screens 2, 5–16 | To be documented |
| **Total documented** | **409** |

Full test case documentation is maintained in `TEST_CASES.md`.
