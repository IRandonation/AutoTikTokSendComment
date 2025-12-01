import os
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

    def get_chrome_options(self):
        options = Options()
        user_data_dir = os.path.join(os.getcwd(), "chrome_user_data")
        options.add_argument(f"--user-data-dir={user_data_dir}")
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
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=self.get_chrome_options())
        
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
        """Helper to switch to the latest opened tab"""
        if not self.driver:
            return
        if len(self.driver.window_handles) > 1:
            if self.driver.current_window_handle != self.driver.window_handles[-1]:
                self.driver.switch_to.window(self.driver.window_handles[-1])
                logger.info(f"Switched to latest tab: {self.driver.title}")

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
                "//textarea[@class='webcast-room__chat_input_editor']",
                "//textarea",
                "//div[@contenteditable='true']"
            ]

            for xpath in xpaths:
                try:
                    textarea = WebDriverWait(self.driver, 1).until(
                        EC.presence_of_element_located((By.XPATH, xpath))
                    )
                    if textarea:
                        break
                except:
                    continue

            if textarea:
                if not textarea.is_enabled() or not textarea.is_displayed():
                    logger.warning("Found chat box but it is not interactable.")
                    return

                textarea.click()
                textarea.clear()
                textarea.send_keys(msg)
                time.sleep(0.2)
                
                send_btn = None
                try:
                    send_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), '发送')]")
                except:
                    pass
                    
                if send_btn:
                    send_btn.click()
                    logger.success(f"Sent: {msg}")
                else:
                    textarea.send_keys(Keys.ENTER)
                    logger.success(f"Sent (Enter): {msg}")
            else:
                title = self.driver.title
                url = self.driver.current_url
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
            # Try to find the video player element
            # This is tricky as it varies. Usually a large container.
            # We can try clicking the center of the screen or a specific element.
            # Using ActionChains to click at offset or on an element
            
            logger.info(f"Starting quick like ({count} times)...")
            
            # Locate a safe element to click (the video container)
            # Often has class 'xgplayer-container' or just body if we are careful
            video_container = None
            try:
                 video_container = self.driver.find_element(By.XPATH, "//div[contains(@class, 'xgplayer-container')]")
            except:
                # Fallback to body but be careful not to click controls
                video_container = self.driver.find_element(By.TAG_NAME, "body")

            actions = ActionChains(self.driver)
            
            for i in range(count):
                if self.stop_event.is_set():
                    break
                
                # Random offset to simulate human clicking different spots? 
                # Or just click. Douyin likes usually require double click or fast clicks.
                # We will just click center or near center.
                
                if video_container:
                    # Move to element and click
                    actions.move_to_element(video_container).click().perform()
                else:
                    actions.click().perform()
                    
                # Very short sleep between clicks
                time.sleep(random.uniform(0.05, 0.15))
                
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
