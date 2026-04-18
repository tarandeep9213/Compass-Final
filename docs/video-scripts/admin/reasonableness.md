---
role: admin
feature: reasonableness
outputFile: admin/reasonableness.webm
estimatedDuration: 55s
viewport: 1440x900
---

# Admin — Reasonableness Reports Walkthrough

Cross-location view of reasonableness tests — how controllers have judged submissions against expected ranges.

## Scene 1 — Opening (0:00 – 0:12)

> The Reasonableness Reports screen shows every saved test across your locations. At the top are three KPI cards that summarise the overall picture — and each one is clickable.

```json
[
  { "type": "login", "role": "admin" },
  { "type": "wait", "ms": 600 },
  { "type": "nav", "panel": "adm-reasonableness" },
  { "type": "wait", "ms": 2500 }
]
```

## Scene 2 — Filter with KPI cards (0:12 – 0:24)

> Click Total Reports to see everything, Reasonable to see only the tests that passed, or Overfunded to zero in on the ones that flagged.

```json
[
  { "type": "hover", "selector": "text=Reasonable" },
  { "type": "wait", "ms": 2000 },
  { "type": "hover", "selector": "text=Overfunded" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 3 — Open a detail report (0:24 – 0:35)

> Each row in the table is a saved test. Click View on any row to open the detail modal — this is where the real story lives.

```json
[
  { "type": "hover", "selector": "[data-screenshot-trigger='reasonableness-view']" },
  { "type": "wait", "ms": 1500 },
  { "type": "click", "selector": "[data-screenshot-trigger='reasonableness-view']" },
  { "type": "wait", "ms": 2000 }
]
```

## Scene 4 — Inside the detail modal (0:35 – 0:50)

> The modal shows one card per location covered by the test, with a six-column financial breakdown — Total, Expected Fund, Actual Fund, Over or Under, Less Cushion, and Net. The Conclusion and Required Actions fields capture the preparer's narrative.

```json
[
  { "type": "hover", "selector": "[data-screenshot='reasonableness-detail-modal']" },
  { "type": "wait", "ms": 4000 }
]
```

## Scene 5 — Wrap (0:50 – 0:55)

> Close the modal with the X in the top right, or click outside the panel. That's the Admin Reasonableness Reports.

```json
[
  { "type": "wait", "ms": 2500 }
]
```
