import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk
import sys
import json
import os
import threading
from douyin_bot import DouyinBot
from loguru import logger

class TextHandler:
    """Redirect loguru logs to Tkinter Text widget"""
    def __init__(self, text_widget):
        self.text_widget = text_widget

    def write(self, message):
        self.text_widget.configure(state='normal')
        self.text_widget.insert(tk.END, message)
        self.text_widget.see(tk.END)
        self.text_widget.configure(state='disabled')

    def flush(self):
        pass

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("抖音直播自动弹幕助手 (Douyin Auto Sender) v2.0")
        self.root.geometry("700x650")
        
        self.bot = DouyinBot()
        
        # Variables
        self.url_var = tk.StringVar()
        self.interval_var = tk.StringVar(value="10")
        self.single_msg_var = tk.StringVar()
        
        self.presets = {}
        self.load_presets()

        self.create_widgets()
        self.setup_logging()

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def load_presets(self):
        try:
            file_path = os.path.join(os.getcwd(), "comments.json")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.presets = json.load(f)
            else:
                self.presets = {}
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load presets: {e}")
            self.presets = {}

    def create_widgets(self):
        # === Top Frame: Settings ===
        settings_frame = tk.LabelFrame(self.root, text="基础设置 (Settings)", padx=10, pady=10)
        settings_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # URL
        tk.Label(settings_frame, text="直播间链接 (可选):").grid(row=0, column=0, sticky="w")
        tk.Entry(settings_frame, textvariable=self.url_var, width=50).grid(row=0, column=1, padx=5, pady=5)
        tk.Button(settings_frame, text="1. 打开浏览器", command=self.open_browser, bg="#e1f5fe").grid(row=0, column=2, padx=5)

        # Interval
        tk.Label(settings_frame, text="发送间隔 (秒):").grid(row=1, column=0, sticky="w")
        tk.Entry(settings_frame, textvariable=self.interval_var, width=10).grid(row=1, column=1, sticky="w", padx=5, pady=5)
        tk.Label(settings_frame, text="(实际发送时间会在 ±20% 范围内波动)").grid(row=1, column=1, padx=80, sticky="w")

        # === Middle Frame: Auto Send ===
        auto_frame = tk.LabelFrame(self.root, text="自动发送 (Auto Loop)", padx=10, pady=10)
        auto_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        tk.Label(auto_frame, text="弹幕列表 (一行一条，按顺序循环发送):").pack(anchor="w")
        
        # Preset Selection
        preset_frame = tk.Frame(auto_frame)
        preset_frame.pack(fill=tk.X, pady=2)
        tk.Label(preset_frame, text="选择话术库 (Select Preset):").pack(side=tk.LEFT)
        
        self.preset_combobox = ttk.Combobox(preset_frame, values=list(self.presets.keys()), state="readonly")
        self.preset_combobox.pack(side=tk.LEFT, padx=5)
        self.preset_combobox.bind("<<ComboboxSelected>>", self.on_preset_change)

        self.comments_text = scrolledtext.ScrolledText(auto_frame, height=6)
        self.comments_text.pack(fill=tk.X, pady=5)
        self.comments_text.insert(tk.END, "主播好棒！\n666\n主播喝口水吧\n支持支持\n")
        
        btn_frame = tk.Frame(auto_frame)
        btn_frame.pack(fill=tk.X, pady=5)
        tk.Button(btn_frame, text="2. 开始循环发送", command=self.start_loop, bg="#c8e6c9", width=20).pack(side=tk.LEFT, padx=5)
        tk.Button(btn_frame, text="停止循环", command=self.stop_loop, bg="#ffcdd2", width=20).pack(side=tk.LEFT, padx=5)

        # === Bottom Frame: Manual Actions ===
        manual_frame = tk.LabelFrame(self.root, text="手动操作 (Manual Actions)", padx=10, pady=10)
        manual_frame.pack(fill=tk.X, padx=10, pady=5)
        
        # Immediate Send
        tk.Label(manual_frame, text="插队弹幕:").grid(row=0, column=0, sticky="w")
        tk.Entry(manual_frame, textvariable=self.single_msg_var, width=40).grid(row=0, column=1, padx=5)
        tk.Button(manual_frame, text="立即发送", command=self.send_immediate).grid(row=0, column=2, padx=5)
        
        # Quick Like
        tk.Button(manual_frame, text="快速点赞 (50次)", command=lambda: self.send_likes(50), bg="#fff9c4").grid(row=0, column=3, padx=20)

        # === Log Area ===
        log_frame = tk.LabelFrame(self.root, text="运行日志 (Logs)", padx=10, pady=5)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, state='disabled', height=8)
        self.log_text.pack(fill=tk.BOTH, expand=True)

    def setup_logging(self):
        handler = TextHandler(self.log_text)
        logger.remove()
        logger.add(handler, format="{time:HH:mm:ss} | {level} | {message}")

    def on_preset_change(self, event):
        selected_name = self.preset_combobox.get()
        if selected_name in self.presets:
            comments = self.presets[selected_name]
            self.comments_text.delete("1.0", tk.END)
            self.comments_text.insert(tk.END, "\n".join(comments))
            logger.info(f"已加载话术库: {selected_name}")

    def open_browser(self):
        url = self.url_var.get().strip()
        def _open():
            try:
                logger.info("正在打开浏览器...")
                self.bot.open_url(url if url else None)
                if url:
                    logger.success("浏览器已打开，请手动登录并确认进入直播间。")
                else:
                    logger.success("浏览器已打开 (抖音主页)。请手动登录，并搜索/点击进入你要发送弹幕的直播间。")
            except Exception as e:
                logger.error(f"打开浏览器失败: {e}")
        threading.Thread(target=_open, daemon=True).start()

    def start_loop(self):
        # Get comments
        raw_text = self.comments_text.get("1.0", tk.END).strip()
        if not raw_text:
            messagebox.showwarning("提示", "请至少输入一条弹幕内容")
            return
        comments = [line.strip() for line in raw_text.split('\n') if line.strip()]
        
        # Get interval
        try:
            interval = float(self.interval_var.get())
            if interval < 1: raise ValueError
        except:
            messagebox.showerror("错误", "间隔必须是大于1的数字")
            return

        if not self.bot.driver:
             messagebox.showwarning("提示", "请先点击'打开浏览器'")
             return

        logger.info(f"启动循环: {len(comments)} 条弹幕, 基准间隔 {interval}秒 (±20%)")
        self.bot.start_sending(interval, comments)

    def stop_loop(self):
        self.bot.stop_sending()

    def send_immediate(self):
        msg = self.single_msg_var.get().strip()
        if not msg:
            return
        if not self.bot.driver:
            messagebox.showwarning("提示", "浏览器未打开")
            return
        
        logger.info(f"正在插队发送: {msg}")
        self.bot.send_immediate(msg)
        self.single_msg_var.set("") # Clear input

    def send_likes(self, count):
        if not self.bot.driver:
            messagebox.showwarning("提示", "浏览器未打开")
            return
        logger.info(f"开始快速点赞 {count} 次")
        self.bot.send_likes(count)

    def on_close(self):
        if messagebox.askokcancel("退出", "确定要退出吗？"):
            self.bot.close()
            self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
