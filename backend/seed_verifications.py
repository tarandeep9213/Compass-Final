"""Seed fake verification data for controllers and DGMs."""
import uuid
from datetime import date, timedelta
from app.db.session import SessionLocal
from app.models.verification import Verification, VerificationStatus, VerificationType
from app.models.user import User

DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

db = SessionLocal()
today = date(2026, 3, 6)

def past(n): return (today - timedelta(days=n)).isoformat()
def future(n): return (today + timedelta(days=n)).isoformat()
def dow(d_str):
    d = date.fromisoformat(d_str)
    return d.weekday(), DAY_NAMES[d.weekday()]

def add_ctrl(uid, uname, loc_id, loc_name, d_str, status,
             observed=None, missed_reason=None, scheduled_time='10:00', warn=False):
    dw, dn = dow(d_str)
    db.add(Verification(
        id=str(uuid.uuid4()),
        verification_type=VerificationType.CONTROLLER,
        location_id=loc_id, location_name=loc_name,
        verifier_id=uid, verifier_name=uname,
        verification_date=d_str, scheduled_time=scheduled_time,
        day_of_week=dw, day_name=dn,
        status=status, warning_flag=warn,
        notes='Routine controller visit' if status == VerificationStatus.COMPLETED else '',
        observed_total=observed,
        missed_reason=missed_reason,
    ))

def add_dgm(uid, uname, loc_id, loc_name, d_str, status,
            observed=None, missed_reason=None):
    dw, dn = dow(d_str)
    db.add(Verification(
        id=str(uuid.uuid4()),
        verification_type=VerificationType.DGM,
        location_id=loc_id, location_name=loc_name,
        verifier_id=uid, verifier_name=uname,
        verification_date=d_str, scheduled_time=None,
        day_of_week=dw, day_name=dn,
        status=status, warning_flag=False,
        notes='Monthly DGM cash room visit' if status == VerificationStatus.COMPLETED else '',
        observed_total=observed,
        missed_reason=missed_reason,
        month_year=d_str[:7],
    ))

def get(email):
    u = db.query(User).filter_by(email=email).first()
    if not u:
        raise ValueError(f'User not found: {email}')
    return u

# ── CONTROLLER: Terri Serrano -> loc-appleton ─────────────────────────────────
c1 = get('terri.serrano@compass.com')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(70), VerificationStatus.COMPLETED, observed=9450.00, scheduled_time='09:00')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(56), VerificationStatus.COMPLETED, observed=9600.00, scheduled_time='10:30')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(42), VerificationStatus.COMPLETED, observed=9575.00, scheduled_time='09:00')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(28), VerificationStatus.MISSED,    missed_reason='Travel or transport issue')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(14), VerificationStatus.COMPLETED, observed=9800.00, scheduled_time='11:00')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', past(7),  VerificationStatus.COMPLETED, observed=9575.00, scheduled_time='09:00')
# Same DOW as past(7) two weeks in a row -> DOW warning trigger
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', future(7),  VerificationStatus.SCHEDULED, scheduled_time='09:00', warn=True)
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', future(21), VerificationStatus.SCHEDULED, scheduled_time='10:00')
add_ctrl(c1.id, c1.name, 'loc-appleton', 'APPLETON', future(35), VerificationStatus.SCHEDULED, scheduled_time='09:30')

# ── CONTROLLER: Connie Ping -> loc-central-il ─────────────────────────────────
c2 = get('connie.ping@compass.com')
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', past(60), VerificationStatus.COMPLETED, observed=8200.00)
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', past(45), VerificationStatus.COMPLETED, observed=8350.00)
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', past(30), VerificationStatus.MISSED,    missed_reason='Operational conflict - staff not available')
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', past(15), VerificationStatus.COMPLETED, observed=8100.00)
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', future(5),  VerificationStatus.SCHEDULED, scheduled_time='14:00')
add_ctrl(c2.id, c2.name, 'loc-central-il', 'CENTRAL IL', future(19), VerificationStatus.SCHEDULED, scheduled_time='09:00')

# ── CONTROLLER: Chris Controller (demo) -> loc-1, loc-2, loc-3 ───────────────
c3 = get('controller@compass.com')
for loc_id, loc_name, base in [('loc-1','The Grange Hotel',9575),
                                 ('loc-2','Compass HQ Canteen',7200),
                                 ('loc-3','Euston Station Bistro',5800)]:
    add_ctrl(c3.id, c3.name, loc_id, loc_name, past(50), VerificationStatus.COMPLETED, observed=float(base))
    add_ctrl(c3.id, c3.name, loc_id, loc_name, past(35), VerificationStatus.COMPLETED, observed=float(base) * 1.02)
    add_ctrl(c3.id, c3.name, loc_id, loc_name, past(20), VerificationStatus.MISSED,    missed_reason='Personal / medical emergency')
    add_ctrl(c3.id, c3.name, loc_id, loc_name, past(5),  VerificationStatus.COMPLETED, observed=float(base) * 0.99)
    add_ctrl(c3.id, c3.name, loc_id, loc_name, future(9),  VerificationStatus.SCHEDULED, scheduled_time='09:00')
    add_ctrl(c3.id, c3.name, loc_id, loc_name, future(23), VerificationStatus.SCHEDULED, scheduled_time='11:00')

# ── CONTROLLER: Akilah Bililty -> loc-omaha ───────────────────────────────────
c4 = get('akilah.bililty@compass.com')
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', past(55), VerificationStatus.COMPLETED, observed=6800.00)
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', past(40), VerificationStatus.COMPLETED, observed=6950.00)
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', past(25), VerificationStatus.COMPLETED, observed=6800.00)
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', past(10), VerificationStatus.MISSED,    missed_reason='Location access unavailable')
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', future(4),  VerificationStatus.SCHEDULED, scheduled_time='10:00')
add_ctrl(c4.id, c4.name, 'loc-omaha', 'OMAHA', future(18), VerificationStatus.SCHEDULED, scheduled_time='10:00')

# ── DGM: John Ranallo -> loc-appleton ────────────────────────────────────────
d1 = get('john.ranallo@compass.com')
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', '2025-10-14', VerificationStatus.COMPLETED, observed=9450.00)
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', '2025-11-11', VerificationStatus.COMPLETED, observed=9575.00)
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', '2025-12-09', VerificationStatus.MISSED,    missed_reason='Location closed for holidays')
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', '2026-01-13', VerificationStatus.COMPLETED, observed=9200.00)
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', '2026-02-10', VerificationStatus.COMPLETED, observed=9575.00)
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', future(18), VerificationStatus.SCHEDULED)   # March
add_dgm(d1.id, d1.name, 'loc-appleton', 'APPLETON', future(49), VerificationStatus.SCHEDULED)   # April

# ── DGM: Gregg Berndt -> loc-des-moines ──────────────────────────────────────
d2 = get('gregg.berndt@compass.com')
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', '2025-11-18', VerificationStatus.COMPLETED, observed=7800.00)
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', '2025-12-16', VerificationStatus.COMPLETED, observed=7900.00)
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', '2026-01-20', VerificationStatus.MISSED,    missed_reason='Travel or transport issue')
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', '2026-02-17', VerificationStatus.COMPLETED, observed=7750.00)
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', future(14), VerificationStatus.SCHEDULED)
add_dgm(d2.id, d2.name, 'loc-des-moines', 'DES MOINES', future(45), VerificationStatus.SCHEDULED)

# ── DGM: Diana DGM (demo) -> loc-1 ───────────────────────────────────────────
d3 = get('dgm@compass.com')
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', '2025-10-08', VerificationStatus.COMPLETED, observed=9600.00)
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', '2025-11-12', VerificationStatus.COMPLETED, observed=9575.00)
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', '2025-12-10', VerificationStatus.COMPLETED, observed=9400.00)
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', '2026-01-14', VerificationStatus.MISSED,    missed_reason='Rescheduled by area manager')
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', '2026-02-11', VerificationStatus.COMPLETED, observed=9575.00)
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', future(11), VerificationStatus.SCHEDULED)
add_dgm(d3.id, d3.name, 'loc-1', 'The Grange Hotel', future(42), VerificationStatus.SCHEDULED)

# ── DGM: Bill Zonzo -> loc-madison ───────────────────────────────────────────
d4 = get('bill.zonzo@compass.com')
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', '2025-11-05', VerificationStatus.COMPLETED, observed=5400.00)
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', '2025-12-03', VerificationStatus.COMPLETED, observed=5500.00)
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', '2026-01-07', VerificationStatus.COMPLETED, observed=5350.00)
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', '2026-02-04', VerificationStatus.MISSED,    missed_reason='Personal / medical emergency')
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', future(8),  VerificationStatus.SCHEDULED)
add_dgm(d4.id, d4.name, 'loc-madison', 'MADISON', future(36), VerificationStatus.SCHEDULED)

db.commit()
db.close()

print('Verification data seeded successfully.')
print()
print('Controllers seeded:')
print('  Terri Serrano    (terri.serrano@compass.com)  -> APPLETON      6 past + 3 scheduled')
print('  Connie Ping      (connie.ping@compass.com)    -> CENTRAL IL    4 past + 2 scheduled')
print('  Chris Controller (controller@compass.com)     -> loc-1,2,3     4 each + 2 scheduled each')
print('  Akilah Bililty   (akilah.bililty@compass.com) -> OMAHA         4 past + 2 scheduled')
print()
print('DGMs seeded:')
print('  John Ranallo  (john.ranallo@compass.com)    -> APPLETON    5 monthly + 2 scheduled')
print('  Gregg Berndt  (gregg.berndt@compass.com)    -> DES MOINES  4 monthly + 2 scheduled')
print('  Diana DGM     (dgm@compass.com)             -> loc-1        5 monthly + 2 scheduled')
print('  Bill Zonzo    (bill.zonzo@compass.com)      -> MADISON     4 monthly + 2 scheduled')
