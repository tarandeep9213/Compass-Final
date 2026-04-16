"""Take screenshots of all CashRoom screens for the user manual."""
import asyncio
from playwright.async_api import async_playwright
import os

BASE = "http://ec2-44-208-172-161.compute-1.amazonaws.com"
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PW = "screenshot123"
USERS = {
    "operator": "ss-op@test.com",
    "controller": "ss-ctrl@test.com",
    "dgm": "ss-dgm@test.com",
    "rc": "ss-rc@test.com",
    "admin": "ss-admin@test.com",
}


async def login(page, email):
    await page.goto(BASE)
    await page.evaluate("() => { localStorage.clear(); sessionStorage.clear() }")
    await page.reload()
    await page.wait_for_load_state("networkidle")
    await page.locator("input").first.fill(email)
    await page.locator('input[type="password"]').fill(PW)
    await page.locator('button:has-text("Sign In")').click()
    await page.wait_for_timeout(4000)


async def ss(page, name, delay=2000):
    await page.wait_for_timeout(delay)
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    await page.screenshot(path=path, full_page=False)
    print(f"  OK: {name}.png")


async def click_nav(page, text, timeout=3000):
    nav = page.locator(f'text={text}').first
    if await nav.is_visible(timeout=timeout):
        await nav.click()
        return True
    return False


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1400, "height": 900})

        # Login screen
        print("1. Login screen")
        page = await ctx.new_page()
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await ss(page, "01_login_screen")

        # Forgot password
        print("2. Forgot password")
        await page.locator('text=Forgot password').first.click()
        await ss(page, "02_forgot_password", 1500)
        await page.locator('text=Back to sign in').first.click()
        await page.wait_for_timeout(1000)
        await page.close()

        # OPERATOR
        print("3. Operator screens")
        page = await ctx.new_page()
        await login(page, USERS["operator"])
        await ss(page, "03_operator_dashboard")

        # Try submit flow
        try:
            btn = page.locator('button:has-text("Submit Now")').first
            if await btn.is_visible(timeout=3000):
                await btn.click()
                await ss(page, "04_operator_method_select", 2000)
                # Click Form
                form = page.locator('button:has-text("Form"), div:has-text("Form")').first
                if await form.is_visible(timeout=2000):
                    await form.click()
                    await ss(page, "05_operator_form", 3000)
                    # Scroll down to see more of the form
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                    await ss(page, "05b_operator_form_bottom", 1500)
        except Exception as e:
            print(f"  skip: {e}")
        await page.close()

        # CONTROLLER
        print("4. Controller screens")
        page = await ctx.new_page()
        await login(page, USERS["controller"])
        await ss(page, "06_controller_daily_review")

        if await click_nav(page, "Weekly Review"):
            await ss(page, "07_controller_weekly_review", 3000)

        if await click_nav(page, "Review DGM"):
            await ss(page, "07b_controller_dgm_review", 2000)

        if await click_nav(page, "Reasonableness"):
            await ss(page, "08_controller_reasonableness", 2000)
        await page.close()

        # DGM
        print("5. DGM screens")
        page = await ctx.new_page()
        await login(page, USERS["dgm"])
        await ss(page, "09_dgm_dashboard")

        if await click_nav(page, "History"):
            await ss(page, "10_dgm_history", 2000)
        await page.close()

        # RC
        print("6. RC screens")
        page = await ctx.new_page()
        await login(page, USERS["rc"])
        await ss(page, "11_rc_business_dashboard", 4000)

        # Scroll down to see compliance table
        await page.evaluate("window.scrollTo(0, 600)")
        await ss(page, "11b_rc_compliance_table", 2000)

        if await click_nav(page, "Reports"):
            await ss(page, "12_rc_reports", 3000)

        if await click_nav(page, "Cash Trends"):
            await ss(page, "13_rc_cash_trends", 3000)

        if await click_nav(page, "Audit Trail"):
            await ss(page, "14_rc_audit_trail", 3000)
        await page.close()

        # ADMIN
        print("7. Admin screens")
        page = await ctx.new_page()
        await login(page, USERS["admin"])
        await ss(page, "15_admin_business_dashboard", 3000)

        if await click_nav(page, "Locations"):
            await ss(page, "16_admin_locations", 2000)

        if await click_nav(page, "Users"):
            await ss(page, "17_admin_users", 2000)

        if await click_nav(page, "Import Roster"):
            await ss(page, "18_admin_import", 2000)

        if await click_nav(page, "Audit Trail"):
            await ss(page, "19_admin_audit", 2000)

        if await click_nav(page, "Reports"):
            await ss(page, "20_admin_reports", 2000)
        await page.close()

        await browser.close()

    # List all screenshots
    files = sorted(os.listdir(SCREENSHOTS_DIR))
    print(f"\nTotal: {len(files)} screenshots")
    for f in files:
        print(f"  {f}")


asyncio.run(main())
