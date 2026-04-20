"""Daily-granularity compliance trend skips Sat/Sun (BUGS_2026-04-20 #1)."""
from datetime import date


def test_daily_trend_has_no_weekend_buckets(client, admin_token):
    # Request 10 daily buckets ending today. Weekends must be skipped,
    # so none of the returned bucket labels should be Sat/Sun.
    r = client.get(
        "/v1/compliance/trend?granularity=daily&periods=10",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    buckets = r.json()["data"]
    assert len(buckets) == 10, "should return the requested number of business-day buckets"
    for b in buckets:
        d = date.fromisoformat(b["start"])
        assert d.weekday() < 5, f"{b['start']} is Sat/Sun — should have been skipped"


def test_daily_trend_buckets_are_contiguous_business_days(client, admin_token):
    """Buckets must be successive business days (Fri → next Mon, not Fri → Sat)."""
    r = client.get(
        "/v1/compliance/trend?granularity=daily&periods=5",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    starts = [date.fromisoformat(b["start"]) for b in r.json()["data"]]
    for prev, cur in zip(starts, starts[1:]):
        # Next business day: +1 if Mon-Thu, +3 if Fri
        expected_gap = 3 if prev.weekday() == 4 else 1
        assert (cur - prev).days == expected_gap, (
            f"non-contiguous business-day buckets: {prev} → {cur} "
            f"(expected gap {expected_gap}, got {(cur - prev).days})"
        )


def test_weekly_trend_untouched(client, admin_token):
    """Weekly granularity wasn't affected by the daily fix — regression check."""
    r = client.get(
        "/v1/compliance/trend?granularity=weekly&periods=4",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()["data"]) == 4
