"""
Seed database from User_details.xlsx (long format: CC#, District, Designation, Name, Email).
- Generates demo emails (firstname.lastname@compass.com) for blank/placeholder email cells
- Updates the Excel file with those emails
- Creates locations and users in the DB (password: demo1234)
Run from backend/: python seed_from_excel.py
"""
import sys, re, uuid, shutil
from pathlib import Path

ROOT = Path(__file__).parent.parent
EXCEL_PATH = ROOT / "User_details.xlsx"

try:
    import openpyxl
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "openpyxl"], check=True)
    import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.location import Location
from app.core.security import hash_password

DEMO_PASSWORD = "demo1234"

DESIG_TO_ROLE = {
    'cashroom lead':       UserRole.OPERATOR,
    'controller':          UserRole.CONTROLLER,
    'dgm/rd':              UserRole.DGM,
    'regional controller': UserRole.REGIONAL_CONTROLLER,
    'division contact':    UserRole.REGIONAL_CONTROLLER,
}

# ── Helpers ────────────────────────────────────────────────────────────────
def cv(cell) -> str:
    v = cell.value
    if v is None:
        return ''
    return str(v).strip().replace('\r', '').replace('\n', ' ').strip()

def name_to_email(name: str) -> str:
    name = re.sub(r'\(.*?\)', '', name)         # strip (Nick), (Alex), (Pat)
    name = re.sub(r'[^a-zA-Z\s]', '', name)    # letters and spaces only
    parts = name.lower().split()
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[-1]}@compass.com"
    return f"{parts[0]}@compass.com" if parts else "unknown@compass.com"

def split_names(raw: str) -> list:
    """Split 'Joseph Conwell & Areli Franco' into two names."""
    return [n.strip() for n in re.split(r'[&,]', raw) if n.strip()]

def is_placeholder_email(email: str) -> bool:
    return not email or email.upper().startswith('XXX')

# ── Load workbook ──────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb.active
all_rows = list(ws.iter_rows())

# Row 0 is header
data_rows = all_rows[1:]
print(f"Data rows: {len(data_rows)}")

# ── Parse rows ─────────────────────────────────────────────────────────────
# person_map: email -> {name, email, role, locations (set)}
person_map: dict = {}
# location_set: district name -> cc number
location_set: dict = {}

# Carry-forward: within same designation group, if Name is blank, use previous name
prev_name_by_desig: dict = {}

for row in data_rows:
    cc      = cv(row[0])
    dist    = cv(row[1])
    desig   = cv(row[2]).lower()
    name    = cv(row[3])
    email   = cv(row[4])

    # Carry forward name within same designation
    if not name and desig in prev_name_by_desig:
        name = prev_name_by_desig[desig]
    elif name:
        prev_name_by_desig[desig] = name

    if not name or not desig:
        continue

    role = DESIG_TO_ROLE.get(desig)
    if role is None:
        print(f"  Unknown designation: '{desig}'")
        continue

    # Track location (skip NA districts)
    if dist and dist.upper() != 'NA':
        if dist not in location_set:
            location_set[dist] = cc

    # Handle multiple names on one row (e.g. "Joseph Conwell & Areli Franco")
    names = split_names(name)
    for person_name in names:
        if is_placeholder_email(email) or len(names) > 1:
            person_email = name_to_email(person_name).lower()
        else:
            person_email = email.lower()

        if person_email not in person_map:
            person_map[person_email] = {
                'name': person_name,
                'email': person_email,
                'role': role,
                'locations': set(),
            }
        # Add this district to their locations
        if dist and dist.upper() != 'NA':
            person_map[person_email]['locations'].add(dist)

print(f"Unique people: {len(person_map)}")
print(f"Unique locations: {len(location_set)}")

# ── Write emails back to Excel ─────────────────────────────────────────────
# For each data row: if email is blank/placeholder, fill with generated email
email_updates = 0
prev_name_by_desig_pass2: dict = {}

for row in data_rows:
    name_cell  = row[3]
    email_cell = row[4]
    desig      = cv(row[2]).lower()
    name_val   = cv(name_cell)
    email_val  = cv(email_cell)

    # Carry forward for display
    if not name_val and desig in prev_name_by_desig_pass2:
        name_val = prev_name_by_desig_pass2[desig]
    elif name_val:
        prev_name_by_desig_pass2[desig] = name_val

    if name_val and is_placeholder_email(email_val):
        names = split_names(name_val)
        generated = ', '.join(name_to_email(n) for n in names if n)
        email_cell.value = generated
        email_updates += 1
    elif name_val and not email_val:
        names = split_names(name_val)
        generated = ', '.join(name_to_email(n) for n in names if n)
        email_cell.value = generated
        email_updates += 1

wb.save(EXCEL_PATH)
shutil.copy(EXCEL_PATH, ROOT / "frontend" / "public" / "User_details.xlsx")
print(f"Excel updated: {email_updates} email cells filled, saved to frontend/public/")

# ── Seed database ──────────────────────────────────────────────────────────
db = next(get_db())

location_map: dict = {}   # district -> location.id
new_loc_count = 0

for dist in location_set:
    existing = db.query(Location).filter(Location.name == dist).first()
    if existing:
        location_map[dist] = existing.id
    else:
        loc = Location(
            id=str(uuid.uuid4()),
            name=dist,
            city=dist,
            expected_cash=9575.0,
            active=True,
        )
        db.add(loc)
        location_map[dist] = loc.id
        new_loc_count += 1

db.flush()
print(f"Locations: {new_loc_count} created, {len(location_map) - new_loc_count} already existed")

pw_hash = hash_password(DEMO_PASSWORD)
created = updated = 0

for person in person_map.values():
    location_ids = [location_map[d] for d in person['locations'] if d in location_map]
    existing = db.query(User).filter(User.email == person['email']).first()
    if existing:
        existing.location_ids = location_ids
        existing.name = person['name']
        updated += 1
    else:
        db.add(User(
            id=str(uuid.uuid4()),
            name=person['name'],
            email=person['email'],
            hashed_password=pw_hash,
            role=person['role'],
            location_ids=location_ids,
            access_grants=[],
            active=True,
        ))
        created += 1

db.commit()
print(f"Users: {created} created, {updated} updated")
print(f"\nPassword for all imported users: {DEMO_PASSWORD}")
print("\nSample logins:")
for p in list(person_map.values())[:10]:
    print(f"  {p['email']:<42} {p['role'].value:<22} {p['name']}")
