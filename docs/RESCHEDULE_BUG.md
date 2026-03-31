# Reschedule Bug: Duplicate Entry and Missing Details

## Problem

When a controller cancels a visit and reschedules it for the same date at a different time, two issues appear on the dashboard:

1. **Duplicate entry** — both the cancelled and the new visit appear as separate rows for the same date
2. **Missing details** — the cancelled visit shows "—" for its status and has no action buttons

### Steps to Reproduce

1. Schedule a controller visit for 13 Apr @ 10:00
2. Cancel that visit
3. Reschedule a new visit for 13 Apr @ 14:00
4. Open the Controller Dashboard

**Expected:** Both visits visible with correct statuses — cancelled one clearly marked, new one showing as scheduled.

**Actual:** Two rows for 13 Apr. The cancelled visit shows "—" for status, no action buttons, and no way to view cancellation details.

---

## Root Cause

The backend correctly allows rescheduling to the same date (cancelled visits are excluded from the duplicate check). However, the frontend was never built to handle the `cancelled` status.

### Affected Code

#### Frontend — `CtrlDashboard.tsx`

| Location | Issue |
|----------|-------|
| ~line 56 | `StatusFilter` type is `'all' \| 'scheduled' \| 'completed' \| 'missed'` — no `cancelled` |
| ~line 67-90 | `StatusBadge` component has cases for `scheduled`, `completed`, `missed` — no `cancelled` case, falls through to `<span>—</span>` |
| ~line 497-518 | Filter chips only render `all`, `scheduled`, `completed`, `missed` — no `cancelled` chip |
| ~line 815-817 | Action menu handles `scheduled`, `completed`, `missed` — cancelled falls to else branch showing "—" with no buttons |

---

## Proposed Solution

Since rescheduling to the same date is allowed, the frontend needs to properly support the `cancelled` status.

### 1. Add `cancelled` to `StatusFilter`

```typescript
type StatusFilter = 'all' | 'scheduled' | 'completed' | 'missed' | 'cancelled'
```

### 2. Add `cancelled` case to `StatusBadge`

```typescript
if (status === 'cancelled') return (
  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--wg)', opacity: 0.7 }}>
    ⊘ Cancelled
  </span>
)
```

### 3. Add `cancelled` filter chip

Add `'cancelled'` to the filter chips array alongside the existing statuses:

```typescript
{(['all', 'scheduled', 'completed', 'missed', 'cancelled'] as const).map(s => {
  const labels = {
    all: 'All', scheduled: '📅 Scheduled', completed: '✅ Completed',
    missed: '❌ Missed', cancelled: '⊘ Cancelled',
  }
  ...
})}
```

### 4. Add cancelled action menu entry

Show a read-only detail view for cancelled visits:

```typescript
: v.status === 'cancelled' ? (
  <span style={{ fontSize: 11, color: 'var(--wg)', opacity: 0.7 }}>
    ⊘ Cancelled
  </span>
) : (
  <span>—</span>
)
```

If cancellation reason/notes are stored, add a "View Details" button that shows the reason in the expand panel.

### 5. Visual treatment for cancelled rows

Dim cancelled visit rows so the active (scheduled) visit stands out:

```typescript
style={{ opacity: v.status === 'cancelled' ? 0.5 : 1 }}
```

This makes it immediately clear which visit is current and which was cancelled, without hiding any information.
