# Compass Phase 3 — Full Automation Strategy for Alarm Testing

**Version:** 1.0
**Date:** 2026-03-30
**Status:** Research & Discovery

---

## 1. Current Manual Process (10 Steps)

Today, each building goes through this workflow every month:

| Step | Who | Action | Time | Pain Point |
|---|---|---|---|---|
| 1 | Tester | Decides to run the monthly alarm test | — | No system reminder |
| 2 | Tester | Calls the security monitoring company by phone | ~5 min | Manual phone call, password verification |
| 3 | Security Co. | Puts the alarm system into "Test Mode" | ~2 min | Requires human operator at the monitoring station |
| 4 | Tester | Physically walks the building triggering every zone (doors, motion sensors, panic buttons) | 15–20 min | **Cannot be automated — physical activity** |
| 5 | Tester | Calls back to take the system off test mode | ~3 min | Another manual phone call |
| 6 | Tester | Calls or emails the security company to request the Customer Activity Report (PDF) | ~5 min | Manual request, sometimes delayed |
| 7 | Security Co. | Generates and emails the PDF report | Hours–days | No SLA, tester has to follow up |
| 8 | Tester | Saves the PDF to a Microsoft Teams folder | ~2 min | Reports scattered across Teams folders |
| 9 | Tester | Opens the shared "Alarm Test Flash" Excel and marks the building as complete | ~3 min | Manual, error-prone, no validation |
| 10 | Management | Periodically opens the Excel to check compliance (if they remember) | ~10 min | No dashboards, no alerts, no transparency |

**Total manual effort per building per month:** ~45 minutes + waiting time for the report

**For 200 buildings:** ~150 hours/month of manual effort across the organization

---

## 2. Automation Layers (Progressive Approach)

We recommend automating in layers, each building on the previous:

### Layer 1: Digital Workflow (DONE — Phase 3 Prototype)

**What it replaces:** Steps 8, 9, 10 (Teams, Excel, manual checking)

**What we built:**
- Web-based zone-by-zone checklist replacing the Excel tracker
- PDF upload replacing Teams folders
- Approval workflow (submit → review → approve/reject)
- Real-time dashboards with traffic-light indicators for leadership
- Automated email reminders and escalation for overdue buildings
- Biannual compliance tracking (cellular backup, camera backup)

**Impact:** Eliminates the Excel/Teams chaos, gives leadership visibility, enforces approval gates.

**Effort:** Done (Phase 3 prototype complete)

---

### Layer 2: Auto-Parse Uploaded PDFs

**What it replaces:** Manual review of whether all zones were tested

**How it works:**
1. Tester uploads the Customer Activity Report PDF (as they do today)
2. System parses the PDF to extract zone-level data:
   - Zone numbers and names from lines like: `ENTRY/EXIT BURGLAR (BA4) 'Main Entry Door' (System: 1 Area: 1 Zone: 3)`
   - Alarm trigger + restore pairs per zone
3. System cross-references extracted zones against the configured zone list for that building
4. Auto-flags any configured zones that are **missing** from the report
5. Compliance check becomes automated: "17/18 zones verified from report — Zone 20 (Freezer Panic) not found"

**Challenges:**
- Each security vendor generates reports in different formats
- Zone name matching requires fuzzy logic (report says "Motion South End Main Hallway", system might have "S. Hallway Motion")
- Must handle alarm + restore pairs (a zone is only properly tested if BOTH signals appear)
- Must ignore non-zone events like "Runaway Warning" or "Cancel by User"
- PDF text extraction can be messy (OCR-quality issues, inconsistent spacing)

**Approach for AES reports specifically:**
- The Wausau sample has a consistent format: `EVENT_TYPE (CODE) 'Zone Name' (System: X Area: Y Zone: Z)`
- Regex pattern: `/\(System:\s*\d+\s*Area:\s*(\d+)\s*Zone:\s*(\d+)\)/`
- Extract zone number + area number → match against configured zones
- Look for both alarm signal (e.g., BA4, BA2, PA2) AND restore signal (BH4, BH2, PH2) per zone

**Impact:** Transforms the approver's job from "manually read the PDF and check each zone" to "review the auto-generated compliance report and confirm."

**Effort:** Medium — 2-3 weeks for AES format, additional time per vendor format

---

### Layer 3: Auto-Receive Reports via Email

**What it replaces:** Steps 6-7 (calling to request the report, waiting for it)

**How it works:**
1. Set up a dedicated email inbox (e.g., `alarm-reports@compass-app.com`)
2. Configure the security monitoring company to auto-email the Customer Activity Report to this inbox after every test event
3. System monitors the inbox, auto-matches incoming reports to buildings (via Customer ID in the email/PDF)
4. Report is auto-attached to the corresponding alarm test record
5. Auto-triggers the PDF parsing from Layer 2

**Prerequisites:**
- Security monitoring company must support automated email delivery (most do — it's a standard feature)
- Need a consistent identifier in the email/report to match to the right building (Customer ID like "AES9925")

**Alternative:** If the monitoring company has a web portal where reports can be downloaded, we could build a scraper/integration to pull reports on a schedule.

**Impact:** Eliminates the "call and wait for the report" step. Reports arrive automatically within minutes of the test.

**Effort:** Low-Medium — email ingestion is well-understood (use a service like SendGrid Inbound Parse, AWS SES, or a simple IMAP poller)

---

### Layer 4: Mobile Real-Time Checklist

**What it improves:** Step 4 (the physical walk-through)

**How it works:**
1. Tester opens the Compass app on their phone/tablet before starting the walk-through
2. As they trigger each zone, they tap "Tested" in real-time on their device
3. The app shows which zones are remaining, guiding them through the building
4. GPS/timestamp data is captured per zone (optional — for audit purposes)
5. When complete, the app shows a summary and allows immediate submission

**Why this matters:**
- Currently testers do the walk-through, then go back to their desk and try to remember which zones they tested
- Real-time logging improves accuracy
- The app can show zone locations/descriptions to help new testers who don't know the building layout

**Impact:** Better data quality, faster completion, training aid for new testers.

**Effort:** Medium — the AlarmTestForm already works; making it mobile-responsive and adding offline capability is the main work.

---

### Layer 5: Central Station API Integration (The Big Win)

**What it replaces:** Steps 2, 3, 5, 6, 7 (all phone calls and report requests)

**This is the breakthrough layer** — instead of parsing PDFs, we get structured data directly from the monitoring station's software.

#### How Alarm Monitoring Actually Works

```
Building Alarm Panel
  → AES-IntelliNet Radio Transceiver (hardware by AES Corporation)
  → Mesh radio network
  → Central Monitoring Station Receiver
  → Central Station SOFTWARE (Manitou, DICE, Immix, etc.)
  → Human operator at monitoring station
  → Dispatch if needed
```

**Key insight:** AES Corporation is the **hardware manufacturer** (radio transceivers). They are NOT the monitoring company. The **Customer Activity Report** is generated by the **central station software**, not by AES hardware.

#### Central Station Software Platforms (with API Capabilities)

| Platform | Vendor | Market Position | API Available | Report Export | "On Test" API |
|---|---|---|---|---|---|
| **Manitou** | Bold Group | Market leader, largest installed base | **Yes** — "We have APIs to do these integrations" | Yes — event data export | Likely yes |
| **DICE** | DICE Group | Major player | **Yes** — documented API for third-party integration | Yes | Unknown |
| **Immix CS** | SureView | Growing, cloud-focused | **Yes** — integrates with 500+ vendors, audit trail export | Yes — structured event data | Unknown |
| **MASterMind** | NMC | Legacy, large installed base | Yes — integration capabilities | Yes | Unknown |
| **MicroKey** | MicroKey | Mid-market | Yes — billing/reporting integration | Yes | Unknown |

#### What API Integration Would Enable

If Compass's monitoring company uses Manitou/DICE/Immix and provides API access:

1. **Auto "Put on Test"**: Tester clicks "Start Test" in our app → API call puts the system in test mode → no phone call needed
2. **Real-Time Zone Events**: As the tester triggers each zone, the central station receives the signal → API streams events to our app → zones auto-check in real-time on the tester's screen
3. **Auto "End Test"**: Tester clicks "End Test" → API takes the system off test mode → no phone call needed
4. **Auto-Pull Report**: After test ends, API call retrieves the event log as structured JSON data → no PDF needed, no parsing needed
5. **Auto-Verify Compliance**: System compares API event data against configured zones → instant compliance check with zero manual effort

**This would reduce the process from 45 minutes to ~15 minutes (just the physical walk-through) with zero manual paperwork.**

#### Integration Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│ Compass App  │────►│  Integration │────►│  Central Station    │
│ (Our System) │◄────│  Middleware  │◄────│  API (Manitou/DICE) │
└─────────────┘     └──────────────┘     └─────────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Functions  │
                    ├─────────────┤
                    │ PUT /test   │ → Start/Stop test mode
                    │ GET /events │ → Pull zone event data
                    │ GET /report │ → Pull activity report
                    │ GET /zones  │ → Sync zone configuration
                    └─────────────┘
```

**Effort:** High — depends entirely on the monitoring company's willingness and API documentation quality. Estimate 4-8 weeks for a single vendor integration.

---

### Layer 6: AI-Powered Multi-Vendor PDF Parsing

**What it solves:** Different security vendors produce different report formats

**How it works:**
1. Use an LLM (Claude API or similar) to parse uploaded PDFs regardless of format
2. The AI extracts: zone number, zone name, event type (alarm/restore), timestamp
3. Works across vendor formats without building vendor-specific parsers
4. Confidence scoring — AI flags uncertain extractions for human review

**When to do this:** Only if Compass has many buildings with many different security vendors AND API integration (Layer 5) is not possible for those vendors.

**Impact:** Eliminates the need for vendor-specific parsers. One AI parser handles all formats.

**Effort:** Medium — LLM integration is straightforward, but accuracy validation and edge case handling take time.

---

## 3. The Physical Walk-Through: What Cannot Be Automated

Someone must physically walk through the building and trigger each zone:
- Open doors (entry/exit zones)
- Walk past motion sensors (interior zones)
- Press panic buttons (silent alarm zones)
- Trigger hold-up alarms

**This is inherently manual and cannot be automated without hardware changes** (like remote-triggerable sensors, which would be a completely different project requiring physical installation at every building).

**What we CAN do:**
- Make it faster with a mobile app (Layer 4)
- Make it more reliable with real-time zone tracking
- Make it verifiable by cross-referencing the tester's checklist against the monitoring company's event log

---

## 4. Recommended Automation Roadmap

| Phase | Layer | Timeline | Dependencies | Business Value |
|---|---|---|---|---|
| **Phase 3a (NOW)** | Layer 1: Digital Workflow | Done | None | High — transparency, dashboards, approval flow |
| **Phase 3b** | Layer 2: PDF Auto-Parse (AES format) | 2-3 weeks | AES report samples from multiple buildings | High — auto-verifies zone coverage |
| **Phase 3c** | Layer 3: Email Report Ingestion | 1-2 weeks | Monitoring company configures auto-email | Medium — eliminates report request step |
| **Phase 3d** | Layer 4: Mobile Checklist | 2-3 weeks | None | Medium — improves data quality |
| **Phase 4** | Layer 5: Central Station API | 4-8 weeks | Monitoring company API access agreement | Very High — near-full automation |
| **Phase 4+** | Layer 6: AI Multi-Vendor Parsing | 2-4 weeks | Multiple vendor report samples | Medium — only if many vendors |

---

## 5. Critical Questions for the Client

### Must-Answer (Determines Automation Path)

**Q1. Who is your central monitoring company?**
Not AES (that's the hardware). Who do your testers call to put the system on test? Who generates the Customer Activity Report? This is the company we need to integrate with.

**Q2. What software does your monitoring company run?**
Manitou (Bold Group)? DICE? Immix? MASterMind? Knowing this tells us exactly what API capabilities exist.

**Q3. Is it the same monitoring company for all buildings, or different companies by region?**
If it's one company nationwide, we build one integration. If it's 5 different companies, the complexity multiplies.

**Q4. Would your monitoring company be willing to provide API access?**
This is the key question. If yes, Layer 5 (full automation) is realistic. If no, we optimize around Layers 2-4.

**Q5. Can the monitoring company auto-email reports after each test?**
Even without API access, automated email delivery would enable Layer 3. Most monitoring companies support this — it may just need to be configured.

**Q6. Can you provide sample alarm test reports from 3-5 different buildings?**
We need samples to build and test the PDF parser (Layer 2). Different buildings may have slightly different report formats even from the same vendor.

### Nice-to-Know

**Q7. How many different security vendors/monitoring companies are involved across all buildings?**
Impacts whether we need Layer 6 (AI multi-vendor parsing) or if a single vendor parser suffices.

**Q8. Does your monitoring company have a web portal where testers log in?**
If yes, there may be a self-service report download option we can automate.

**Q9. Would you consider switching monitoring companies to one that offers better API integration?**
A long-term question, but consolidating to a single monitoring company with good API support would dramatically simplify automation.

**Q10. What is the annual cost of the current manual process?**
Helps build the ROI case for automation investment. At ~45 min/building/month × 200 buildings × $30/hour loaded cost = ~$54,000/year in labor alone, plus the compliance risk cost.

---

## 6. ROI Estimate for Full Automation

### Current Cost (Manual Process)

| Item | Calculation | Annual Cost |
|---|---|---|
| Tester time | 200 buildings × 45 min/month × 12 months × $30/hr | **$54,000** |
| Management review time | 200 buildings × 10 min/month × 12 × $50/hr | **$20,000** |
| Compliance failures (audit findings) | Estimated 5 incidents/year × $10,000 avg remediation | **$50,000** |
| Report request/follow-up overhead | 200 buildings × 10 min/month × 12 × $30/hr | **$12,000** |
| **Total manual cost** | | **~$136,000/year** |

### Automated Cost (Layers 1-5)

| Item | Calculation | Annual Cost |
|---|---|---|
| Tester time (physical walk-through only) | 200 buildings × 20 min/month × 12 × $30/hr | **$24,000** |
| Management review (dashboard glance) | 200 buildings × 2 min/month × 12 × $50/hr | **$4,000** |
| Compliance failures (near-zero with automation) | Estimated 0-1 incidents × $10,000 | **$5,000** |
| Software/API licensing (estimated) | Central station API fees + hosting | **$12,000** |
| **Total automated cost** | | **~$45,000/year** |

### **Annual savings: ~$91,000 + significantly reduced compliance risk**

---

## 7. Technology Architecture for Full Automation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPASS ALARM SYSTEM                               │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Mobile App   │  │  Web Portal  │  │  Email       │  │  Central Stn │   │
│  │  (Tester)     │  │  (Mgmt/Admin)│  │  Ingestion   │  │  API Bridge  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                  │            │
│  ┌──────▼─────────────────▼─────────────────▼──────────────────▼───────┐    │
│  │                     COMPASS BACKEND (FastAPI)                       │    │
│  │                                                                    │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌─────────────┐  │    │
│  │  │ Test Mgmt  │  │ PDF Parser │  │ Compliance  │  │ Notification│  │    │
│  │  │ Service    │  │ Service    │  │ Engine      │  │ Service     │  │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └─────────────┘  │    │
│  │                                                                    │    │
│  │  ┌────────────────────────────────────────────────────────────┐    │    │
│  │  │               PostgreSQL Database                          │    │    │
│  │  │  buildings · zones · tests · test_zones · attachments      │    │    │
│  │  │  biannual_checks · compliance_rules · audit_events         │    │    │
│  │  └────────────────────────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
            ┌───────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
            │ Monitoring   │ │  Email     │ │  Cloud      │
            │ Company API  │ │  Provider  │ │  Storage    │
            │ (Manitou/    │ │  (SES/     │ │  (S3 for    │
            │  DICE/Immix) │ │  SendGrid) │ │  reports)   │
            └──────────────┘ └────────────┘ └─────────────┘
```

---

## 8. Summary: What Can and Cannot Be Automated

| Process Step | Can Automate? | How | Layer |
|---|---|---|---|
| Monthly reminder to test | **Yes** | Automated email/notification | Layer 1 (Done) |
| Put system on test mode | **Maybe** | Central station API (if available) | Layer 5 |
| Physical walk-through | **No** | Will always require a human on-site | — |
| Real-time zone tracking | **Maybe** | Central station API streams events to mobile app | Layer 4 + 5 |
| Take system off test mode | **Maybe** | Central station API | Layer 5 |
| Request the test report | **Yes** | Auto-email or API pull | Layer 3 or 5 |
| Verify all zones tested | **Yes** | PDF parsing or API data comparison | Layer 2 or 5 |
| Upload/store the report | **Yes** | Email ingestion or API pull | Layer 3 or 5 |
| Submit for approval | **Yes** | Auto-submit after verification | Layer 2 |
| Review and approve | **Partially** | Auto-approve if all checks pass; flag for human review if issues | Layer 2 |
| Dashboard and reporting | **Yes** | Real-time dashboards (Done) | Layer 1 (Done) |
| Escalation for overdue | **Yes** | Automated email escalation (Done) | Layer 1 (Done) |
| Biannual compliance tracking | **Yes** | Due date tracking + reminders (Done) | Layer 1 (Done) |

**Bottom line:** With Layer 5 (central station API), we can automate everything except the physical walk-through. Without Layer 5, Layers 1-4 still eliminate ~70% of the manual effort and provide 100% visibility.

---

## Sources

- [Manitou by Bold Group — Alarm Monitoring Software](https://www.boldgroup.com/alarm-monitoring-software/manitou/)
- [Manitou Modules — API Integration](https://www.boldgroup.com/alarm-monitoring-software/manitou-modules/)
- [Central Station Integration Software for Alarm Companies](https://workhorsescs.com/2025/12/12/central-station-integration-alarm-company/)
- [SiteLink24 — AES Interactive Security Services](https://www.securityinfowatch.com/alarms-monitoring/central-station-alarm-monitoring/product/10890274/aes-corporation-sitelink-24)
- [AES Corporation — Products](https://aes-corp.com/products/)
- [DICE Central Station Software](https://www.softwareadvice.com/product/111678-dice/)
- [Immix CS — Central Station Monitoring](https://www.immixprotect.com/immix-cs/)
- [Top Central Monitoring Platforms — IPVM](https://ipvm.com/discussions/top-central-monitoring-platforms)
- [Alarm Monitoring Central Station Software Market Report 2034](https://www.marketresearchfuture.com/reports/alarm-monitoring-central-stations-software-market-34483)
