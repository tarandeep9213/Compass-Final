# Timezone Bug: Controller Approval Blocked

## Problem

Controllers (and other roles) cannot approve/complete visits at the correct local time. For example, at 11:45 AM local time, the system may block a visit completion saying "Too early" or "Window has passed" — depending on the user's UTC offset.

### Root Cause

The backend mixes `date.today()` (server-local) and `datetime.now(timezone.utc)` (UTC) inconsistently. Scheduled visit times are stored as plain strings (e.g., `"11:00"`) with no timezone info, but the completion logic interprets them as UTC.

**Example:** A visit scheduled for 11:00 AM at a New York location (UTC-4):
- User clicks "Complete" at 11:45 AM local time
- Backend computes `now_utc` = 3:45 PM UTC
- Backend interprets scheduled time as 11:00 AM **UTC**
- 3:45 PM UTC is 4h45m past 11:00 AM UTC — within the 5-hour window, so this works
- But if the user were in UTC+5:30 (India), 11:45 AM local = 6:15 AM UTC → "Too early"

The system has no concept of what timezone a location operates in.

### Affected Code

| File | Lines | Issue |
|------|-------|-------|
| `backend/app/api/v1/verifications.py` | 234-249 | Complete controller visit — `date.today()` (local) + `datetime.now(timezone.utc)` (UTC) |
| `backend/app/api/v1/verifications.py` | 298-307 | Miss controller visit — same mix |
| `backend/app/api/v1/verifications.py` | 487 | List DGM verifications — filters by `date.today()` |
| `backend/app/api/v1/verifications.py` | 522-527 | Complete DGM visit — `date.today()` |
| `backend/app/api/v1/verifications.py` | 600-602 | Miss DGM visit — `date.today()` |
| `backend/app/api/v1/compliance.py` | 16, 50, 71, 100 | `TODAY` lambda uses `date.today()`, but `submitted_at` is stored as UTC |
| `frontend/src/pages/controller/CtrlDashboard.tsx` | 293 vs 415-416 | Month key uses UTC (`toISOString`), but `todayStr` uses local date — two conflicting "today" values on the same page |
| `frontend/src/pages/manager/MgrApprovals.tsx` | 293 | Month key uses UTC |

---

## Proposed Solution: Timezone Per Location

### Overview

Add a `timezone` column to the `locations` table. All date/time business logic uses the location's timezone instead of UTC or server-local time.

### Why This Approach

- Cash counts and in-person visits are **local business operations** tied to a physical location
- The US spans 4 main timezones (Eastern, Central, Mountain, Pacific)
- "Today" and "11:00 AM" mean different things in New York vs Los Angeles
- Python's `zoneinfo` module (stdlib, no extra dependencies) handles all conversions

### Changes Required

#### 1. Database — Add timezone to locations

```python
# backend/app/models.py — Location model
timezone = Column(String, default="America/New_York")  # IANA timezone
```

Migration: add column with default `"America/New_York"`, update existing locations as needed.

#### 2. Backend — Helper to get "now" in location timezone

```python
# backend/app/core/timezone.py
from datetime import datetime, date
from zoneinfo import ZoneInfo

def now_at_location(tz_name: str) -> datetime:
    return datetime.now(ZoneInfo(tz_name))

def today_at_location(tz_name: str) -> date:
    return datetime.now(ZoneInfo(tz_name)).date()
```

#### 3. Backend — Replace all bare date.today() and datetime.now(timezone.utc)

Every place listed in the "Affected Code" table above needs to:
1. Look up the location's timezone
2. Use `today_at_location(tz)` instead of `date.today()`
3. Use `now_at_location(tz)` instead of `datetime.now(timezone.utc)` for business logic checks (completion windows, scheduling)

Example fix in `verifications.py` (complete controller visit):

```python
# Before
today = dt_date.today()
sched_dt = datetime(..., tzinfo=timezone.utc)
now_utc = datetime.now(timezone.utc)

# After
from app.core.timezone import now_at_location, today_at_location

loc = db.query(Location).get(v.location_id)
tz = loc.timezone or "America/New_York"
today = today_at_location(tz)
now_local = now_at_location(tz)
sched_dt = datetime(visit_date.year, visit_date.month, visit_date.day, h, m,
                    tzinfo=ZoneInfo(tz))
```

#### 4. Frontend — Use local date consistently

Replace all `new Date().toISOString().slice(...)` with local-date helpers:

```typescript
// Use local date for month key
const now = new Date()
const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
```

#### 5. Admin UI — Timezone selector per location

Add a timezone dropdown to the location edit form. Provide US timezone presets:
- `America/New_York` (Eastern)
- `America/Chicago` (Central)
- `America/Denver` (Mountain)
- `America/Los_Angeles` (Pacific)

### Simpler Alternative

If **all** locations are in one timezone (e.g., all East Coast), add a single `SYSTEM_TIMEZONE` config value instead of per-location. Less code, but breaks if locations span multiple zones.
