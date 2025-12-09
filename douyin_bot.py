import os
import sys
import time
import threading
import random
from loguru import logger
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager

class DouyinBot:
    def __init__(self):
        self.driver = None
        self.is_running = False
        self.thread = None
        self.stop_event = threading.Event()
        self.comments_list = []
        self.current_comment_index = 0

    def find_chrome_executable(self):
        """
        Automatically detect OS and find Chrome executable.
        Returns path to chrome executable or None if not found.
        """
        system_platform = sys.platform
        chrome_path = None
        
        logger.info(f"Detecting OS: {system_platform}")
        
        if system_platform.startswith("win"):
            possible_paths = [
                os.path.join(os.environ.get("ProgramFiles", "C:\\Program Files"), "Google\\Chrome\\Application\\chrome.exe"),
                os.path.join(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)"), "Google\\Chrome\\Application\\chrome.exe"),
                os.path.join(os.environ.get("LOCALAPPDATA", "C:\\Users\\Default\\AppData\\Local"), "Google\\Chrome\\Application\\chrome.exe")
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    chrome_path = path
                    break
        elif system_platform == "darwin":
            possible_paths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    chrome_path = path
                    break
        
        if chrome_path:
            logger.info(f"Found Chrome at: {chrome_path}")
        else:
            logger.error("Chrome executable not found.")
            
        return chrome_path

    def get_chrome_options(self, use_user_data=True):
        options = Options()
        if use_user_data:
            user_data_dir = os.path.join(os.getcwd(), "chrome_user_data")
            options.add_argument(f"--user-data-dir={user_data_dir}")
            logger.info(f"Configuration: Using Persistent Profile at {user_data_dir}")
        else:
            logger.info("Configuration: Using Temporary Profile (No Login Saved)")

        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        return options

    def init_driver(self):
        if self.driver:
            return
        
        logger.info("Initializing Chrome Driver...")

        # Find Chrome Binary
        chrome_binary_path = self.find_chrome_executable()
        if not chrome_binary_path:
            raise Exception("Google Chrome not found! Please install Google Chrome to use this application.")

        # Ensure DBUS env is set (fix for some macOS versions)
        if "DBUS_SESSION_BUS_ADDRESS" not in os.environ:
             os.environ["DBUS_SESSION_BUS_ADDRESS"] = "/dev/null"

        try:
            # Mode 1: Attempt to launch with saved user profile
            logger.info("Mode 1: Attempting to launch with saved user profile...")
            options = self.get_chrome_options(use_user_data=True)
            options.binary_location = chrome_binary_path
            
            driver_path = ChromeDriverManager().install()
            
            # Fix for macOS: Ad-hoc sign the chromedriver if needed
            if sys.platform == 'darwin':
                try:
                    logger.info(f"Attempting to sign chromedriver at {driver_path}")
                    os.system(f"codesign --force --deep --sign - '{driver_path}'")
                except Exception as e:
                    logger.warning(f"Failed to sign chromedriver: {e}")

            service = Service(driver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
            logger.success("Success: Chrome launched with User Profile.")
        except Exception as e:
            logger.warning(f"Failed to launch with user profile: {e}")
            logger.warning("Mode 2: Retrying with temporary profile (Login will not be saved)...")
            try:
                options = self.get_chrome_options(use_user_data=False)
                options.binary_location = chrome_binary_path

                driver_path = ChromeDriverManager().install()
                
                # Fix for macOS: Ad-hoc sign the chromedriver if needed
                if sys.platform == 'darwin':
                    try:
                        logger.info(f"Attempting to sign chromedriver at {driver_path}")
                        os.system(f"codesign --force --deep --sign - '{driver_path}'")
                    except Exception as e:
                        logger.warning(f"Failed to sign chromedriver: {e}")

                service = Service(driver_path)
                self.driver = webdriver.Chrome(service=service, options=options)
                logger.success("Success: Chrome launched with Temporary Profile.")
            except Exception as e2:
                 logger.error(f"Critical: Failed to launch Chrome even with temp profile: {e2}")
                 raise e2
        
        if self.driver:
            # Connectivity Check
            try:
                title = self.driver.title
                logger.info(f"Browser Connectivity Check: OK (Current Title: '{title}')")
            except Exception as e:
                logger.error(f"Browser Connectivity Check Failed: {e}")

            self.driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                """
            })

    def open_url(self, url=None):
        if not self.driver:
            self.init_driver()
        
        if url:
             self.driver.get(url)
        else:
             self.driver.get("https://www.douyin.com/")

    def _switch_to_latest_tab(self):
        """
        Helper to switch to the latest opened tab.
        Prioritizes tabs with 'douyin.com' in the URL to avoid internal Chrome pages.
        """
        if not self.driver:
            return
        
        try:
            handles = self.driver.window_handles
            if len(handles) > 1:
                # 1. Try to find a Douyin tab
                for handle in reversed(handles):
                    self.driver.switch_to.window(handle)
                    if "douyin.com" in self.driver.current_url:
                         # Found a likely correct tab
                         return
                
                # 2. Fallback to the last opened tab if no Douyin tab found
                self.driver.switch_to.window(handles[-1])
                logger.info(f"Switched to latest tab: {self.driver.title}")
        except Exception as e:
            logger.warning(f"Failed to switch tabs: {e}")

    def set_native_value(self, element, value):
        """
        Helper to set value using JS to bypass React/Vue limitations.
        Similar to the logic in the UserScript.
        """
        try:
            self.driver.execute_script("""
                var element = arguments[0];
                var value = arguments[1];
                var valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
                var prototype = Object.getPrototypeOf(element);
                var prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

                if (valueSetter && valueSetter !== prototypeValueSetter) {
                    prototypeValueSetter.call(element, value);
                } else {
                    valueSetter.call(element, value);
                }

                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            """, element, value)
        except Exception as e:
            logger.warning(f"Native value set failed, falling back to send_keys: {e}")
            element.clear()
            element.send_keys(value)

    def send_comment_task(self, content=None):
        """
        Sends a single comment. 
        If content is provided, sends that specific content (Immediate Send).
        Otherwise, picks the next one from the list.
        """
        if not self.driver:
            return
        
        self._switch_to_latest_tab()
        
        # Determine content
        msg = content
        if not msg:
            if not self.comments_list:
                return
            msg = self.comments_list[self.current_comment_index]
            # Update index for next time
            self.current_comment_index = (self.current_comment_index + 1) % len(self.comments_list)

        try:
            # Try to find textarea with multiple selectors
            textarea = None
            xpaths = [
                "//textarea[contains(@placeholder, '说点什么')]",
                "//textarea[contains(@class, 'webcast-room__chat_input_editor')]",
                "//textarea[contains(@class, 'xgplayer-input-textarea')]",
                "//textarea",
                "//div[@contenteditable='true']"
            ]

            for xpath in xpaths:
                try:
                    textarea = WebDriverWait(self.driver, 1).until(
                        EC.presence_of_element_located((By.XPATH, xpath))
                    )
                    if textarea and textarea.is_displayed() and textarea.is_enabled():
                        break
                except:
                    continue

            if textarea:
                textarea.click()
                time.sleep(0.1)
                
                # Use robust value setting
                self.set_native_value(textarea, msg)
                
                time.sleep(0.3) # Wait for UI to update
                
                send_btn = None
                # Priority 1: Button with '发送' text
                try:
                    send_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), '发送')]")
                except:
                    # Priority 2: Class based
                    try:
                        send_btn = self.driver.find_element(By.CSS_SELECTOR, ".webcast-room__chat_send_btn")
                    except:
                        pass
                    
                if send_btn and send_btn.is_displayed():
                    # Check if enabled
                    if not send_btn.is_enabled():
                         logger.warning("Send button found but disabled. Trying to trigger input event again.")
                         textarea.send_keys(" ")
                         textarea.send_keys(Keys.BACKSPACE)
                         time.sleep(0.2)
                    
                    if send_btn.is_enabled():
                        send_btn.click()
                        logger.success(f"Sent: {msg}")
                    else:
                        logger.warning("Send button still disabled. Trying Enter key.")
                        textarea.send_keys(Keys.ENTER)
                        logger.success(f"Sent (Enter): {msg}")
                else:
                    textarea.send_keys(Keys.ENTER)
                    logger.success(f"Sent (Enter - No Button): {msg}")
            else:
                # Diagnostics: Check for login popup
                try:
                    login_text = self.driver.find_element(By.XPATH, "//*[contains(text(), '登录') or contains(text(), 'Login')]")
                    if login_text.is_displayed():
                        logger.warning("Operation Blocked: Login Popup detected! Please log in manually.")
                except:
                    pass

                title = self.driver.title
                logger.warning(f"Chat input not found. Title: '{title}'")
                
        except Exception as e:
            logger.error(f"Send Error: {e}")

    def like_task(self, count=10):
        """
        Simulates liking by clicking on the video container/player.
        Double clicking or rapid clicking usually triggers likes.
        """
        if not self.driver:
            return
            
        self._switch_to_latest_tab()
        
        try:
            logger.info(f"Starting quick like ({count} times)...")
            
            # Locate a safe element to click (the video container)
            video_container = None
            try:
                 video_container = self.driver.find_element(By.XPATH, "//div[contains(@class, 'xgplayer-container')]")
            except:
                try:
                    video_container = self.driver.find_element(By.TAG_NAME, "video")
                except:
                    # Fallback to body
                    video_container = self.driver.find_element(By.TAG_NAME, "body")

            for i in range(count):
                if self.stop_event.is_set():
                    break
                
                # Check if driver is still alive
                try:
                    _ = self.driver.current_window_handle
                except Exception as e:
                    logger.error("Browser session lost, stopping likes.")
                    self.stop_event.set()
                    self.driver = None
                    break

                # Re-instantiate ActionChains to avoid accumulation/stale state
                actions = ActionChains(self.driver)
                
                try:
                    if video_container:
                        actions.move_to_element(video_container).click().perform()
                    else:
                        actions.click().perform()
                except Exception as click_err:
                     err_msg = str(click_err)
                     if "invalid session id" in err_msg or "disconnected" in err_msg:
                         logger.error("Critical: Browser closed or crashed during like task.")
                         self.stop_event.set()
                         self.driver = None
                         break
                     
                     # Just a click failure, try to recover
                     logger.warning(f"Click failed: {click_err}. Retrying...")
                     try:
                         video_container = self.driver.find_element(By.XPATH, "//div[contains(@class, 'xgplayer-container')]")
                     except:
                         video_container = self.driver.find_element(By.TAG_NAME, "body")
                     continue
                    
                # Slower sleep to prevent crash
                time.sleep(random.uniform(0.15, 0.25)) 
                
            logger.success(f"Finished sending {count} likes")
            
        except Exception as e:
            logger.error(f"Like Error: {e}")

    def loop_task(self, base_interval, comments):
        self.comments_list = comments
        self.current_comment_index = 0
        
        while not self.stop_event.is_set():
            # 1. Send Comment
            self.send_comment_task()
            
            # 2. Wait with randomized interval
            # Randomize +/- 20%
            variation = base_interval * 0.2
            actual_interval = base_interval + random.uniform(-variation, variation)
            actual_interval = max(1.0, actual_interval) # Minimum 1 second
            
            logger.info(f"Next comment in {actual_interval:.2f}s")
            
            # Sleep in small chunks to allow immediate stopping
            elapsed = 0
            while elapsed < actual_interval:
                if self.stop_event.is_set():
                    break
                time.sleep(0.1)
                elapsed += 0.1
            
            # Check browser health
            try:
                if self.driver:
                    _ = self.driver.title
            except:
                logger.info("Browser closed externally")
                self.stop_event.set()
                break

    def start_sending(self, interval, comments):
        if self.is_running:
            return
        
        self.is_running = True
        self.stop_event.clear()
        
        self.thread = threading.Thread(target=self.loop_task, args=(interval, comments))
        self.thread.daemon = True
        self.thread.start()
        logger.info("Started sending loop")

    def stop_sending(self):
        if not self.is_running:
            return
        
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1.0)
        self.is_running = False
        logger.info("Stopped sending loop")

    def send_immediate(self, content):
        """Fires a single comment immediately in a separate thread to not block GUI"""
        threading.Thread(target=self.send_comment_task, args=(content,), daemon=True).start()

    def send_likes(self, count):
        """Fires likes in a separate thread"""
        threading.Thread(target=self.like_task, args=(count,), daemon=True).start()

    def close(self):
        self.stop_sending()
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None
