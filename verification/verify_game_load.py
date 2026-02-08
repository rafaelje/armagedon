import subprocess
import time
from playwright.sync_api import sync_playwright

def verify_game_load():
    # Start the WebSocket server on port 8080
    ws_server_process = subprocess.Popen(["npx", "tsx", "src/server.ts"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Start a static file server on port 8000 to serve the frontend
    static_server_process = subprocess.Popen(["python3", "-m", "http.server", "8000"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Give the servers a moment to start
    time.sleep(3)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Navigate to the static file server
            page.goto("http://localhost:8000")

            # Wait for the canvas to be present, indicating the game has loaded
            # The canvas has id="game"
            canvas = page.locator("canvas#game")
            canvas.wait_for(state="visible", timeout=10000)

            # Take a screenshot
            page.screenshot(path="verification/game_loaded.png")
            print("Screenshot taken: verification/game_loaded.png")

            browser.close()
    finally:
        # Kill the server processes
        ws_server_process.terminate()
        static_server_process.terminate()
        ws_server_process.wait()
        static_server_process.wait()

if __name__ == "__main__":
    verify_game_load()
