"""Unit tests for the business_days helper (BUGS_2026-04-20 #1)."""
from datetime import date

from app.core.business_days import is_business_day


def test_monday_is_business_day():
    assert is_business_day(date(2026, 4, 20)) is True  # Monday


def test_tuesday_through_friday_are_business_days():
    # 2026-04-21 Tue, 22 Wed, 23 Thu, 24 Fri
    for day in range(21, 25):
        assert is_business_day(date(2026, 4, day)) is True, f"Apr {day} should be a business day"


def test_saturday_not_business_day():
    assert is_business_day(date(2026, 4, 25)) is False  # Saturday


def test_sunday_not_business_day():
    assert is_business_day(date(2026, 4, 26)) is False  # Sunday


def test_next_monday_is_business_day_again():
    assert is_business_day(date(2026, 4, 27)) is True  # Monday
