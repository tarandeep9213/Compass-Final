"""Business-day helpers — pure, timezone-agnostic.

Cashrooms don't operate Saturdays or Sundays. Callers that need to skip
weekend behaviour (scheduler jobs, future closure validation, etc.)
import and use `is_business_day`. Keep this file tiny and dependency-free.
"""
from datetime import date


def is_business_day(d: date) -> bool:
    """True for Mon-Fri, False for Sat/Sun.

    Uses Python's date.weekday(): Monday=0, ..., Friday=4, Saturday=5, Sunday=6.
    """
    return d.weekday() < 5
