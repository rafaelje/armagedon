from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080")

        page.wait_for_selector("#menu-overlay")

        title = page.title()
        print(f"Page title: {title}")

        h1_text = page.inner_text("h1")
        print(f"H1 text: {h1_text}")

        page.screenshot(path="verification/rename_check.png")

        browser.close()

if __name__ == "__main__":
    run()
