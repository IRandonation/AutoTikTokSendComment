// ==UserScript==
// @name         Douyin Auto Sender (抖音直播自动弹幕助手)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Automated comment sender for Douyin Live with custom presets and random intervals.
// @author       AutoTikTokSendComment Project
// @match        *://*.douyin.com/*
// @match        *://live.douyin.com/*
// @icon         https://lf1-cdn-tos.bytegoofy.com/goofy/ies/douyin_web/public/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Default configuration
    const DEFAULT_CONFIG = {
        minInterval: 10,
        maxInterval: 15,
        comments: "来了\n喜欢主播",
        randomize: true
    };

    // State
    let isRunning = false;
    let isLiking = false;
    let timerId = null;
    let likeTimerId = null;
    let currentIndex = 0;

    // Load config
    function getConfig() {
        return {
            minInterval: parseFloat(localStorage.getItem('das_min_interval')) || DEFAULT_CONFIG.minInterval,
            maxInterval: parseFloat(localStorage.getItem('das_max_interval')) || DEFAULT_CONFIG.maxInterval,
            comments: localStorage.getItem('das_comments') || DEFAULT_CONFIG.comments,
            randomize: localStorage.getItem('das_randomize') === 'true'
        };
    }

    function saveConfig(config) {
        localStorage.setItem('das_min_interval', config.minInterval);
        localStorage.setItem('das_max_interval', config.maxInterval);
        localStorage.setItem('das_comments', config.comments);
        localStorage.setItem('das_randomize', config.randomize);
    }

    // UI Creation
    function createUI() {
        const div = document.createElement('div');
        div.id = 'das-panel';
        div.innerHTML = `
            <div class="das-header">
                <span>🤖 抖音自动弹幕</span>
                <span class="das-toggle" id="das-minimize" title="最小化">➖</span>
            </div>
            <div class="das-content" id="das-content">
                <div class="das-row">
                    <label>随机间隔范围 (秒):</label>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="number" id="das-min-interval" value="${getConfig().minInterval}" min="1" step="0.5" style="width: 45%;">
                        <span>-</span>
                        <input type="number" id="das-max-interval" value="${getConfig().maxInterval}" min="1" step="0.5" style="width: 45%;">
                    </div>
                </div>
                <div class="das-row">
                    <label>弹幕列表 (一行一条):</label>
                    <textarea id="das-comments" rows="6" placeholder="输入弹幕...">${getConfig().comments}</textarea>
                </div>
                <div class="das-row">
                    <label>
                        <input type="checkbox" id="das-randomize" ${getConfig().randomize ? 'checked' : ''}> 随机发送顺序
                    </label>
                </div>
                <div class="das-actions">
                    <button id="das-start-btn">开始弹幕</button>
                    <button id="das-like-btn">开始点赞</button>
                    <button id="das-save-btn">保存配置</button>
                </div>
                <div class="das-log" id="das-log">就绪...</div>
            </div>
        `;
        document.body.appendChild(div);

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #das-panel {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 250px;
                background: rgba(20, 20, 20, 0.95);
                color: white;
                border-radius: 8px;
                z-index: 9999;
                font-family: sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                border: 1px solid #333;
                font-size: 12px;
            }
            .das-header {
                padding: 10px;
                background: #ff2c55; /* Douyin Red */
                border-radius: 8px 8px 0 0;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                cursor: move;
                align-items: center;
            }
            .das-toggle { cursor: pointer; font-size: 16px; font-weight: bold; padding: 0 5px; }
            .das-content { padding: 10px; }
            .das-row { margin-bottom: 8px; }
            .das-row label { display: block; margin-bottom: 4px; color: #ccc; }
            .das-row input[type="number"] { width: 100%; background: #333; border: 1px solid #444; color: white; padding: 4px; }
            .das-row textarea { width: 100%; background: #333; border: 1px solid #444; color: white; padding: 4px; resize: vertical; }
            .das-actions { display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; }
            .das-actions button {
                flex: 1 1 30%;
                padding: 6px;
                cursor: pointer;
                border: none;
                border-radius: 4px;
                font-weight: bold;
                min-width: 60px;
            }
            #das-start-btn { background: #28a745; color: white; }
            #das-start-btn.stop { background: #dc3545; }
            #das-like-btn { background: #ffc107; color: black; }
            #das-like-btn.stop { background: #fd7e14; color: white; }
            #das-save-btn { background: #6c757d; color: white; }
            .das-log {
                margin-top: 10px;
                padding: 5px;
                background: #000;
                height: 60px;
                overflow-y: auto;
                font-family: monospace;
                color: #0f0;
                font-size: 10px;
            }
            .hidden { display: none; }
            #das-minimized-icon {
                position: fixed;
                top: 100px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: #ff2c55;
                border-radius: 50%;
                z-index: 9999;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                font-size: 24px;
                user-select: none;
                transition: transform 0.2s;
            }
            #das-minimized-icon:hover { transform: scale(1.1); }
        `;
        document.head.appendChild(style);

        // Minimized Icon
        const minIcon = document.createElement('div');
        minIcon.id = 'das-minimized-icon';
        minIcon.innerHTML = '🤖';
        minIcon.title = '打开控制面板';
        minIcon.style.display = 'none';
        minIcon.onclick = () => {
            // Prevent opening if it was just dragged
            if (minIcon.dataset.dragged === 'true') {
                minIcon.dataset.dragged = 'false'; // Reset
                return;
            }
            minIcon.style.display = 'none';
            const panel = document.getElementById('das-panel');
            panel.style.display = 'block';
            // Sync position back to panel if icon was moved
            panel.style.top = minIcon.style.top;
            panel.style.left = minIcon.style.left;
        };
        document.body.appendChild(minIcon);

        // Event Listeners
        document.getElementById('das-start-btn').addEventListener('click', toggleRunning);
        document.getElementById('das-like-btn').addEventListener('click', toggleLiking);
        document.getElementById('das-save-btn').addEventListener('click', () => {
            saveConfigFromUI();
            log("配置已保存");
        });
        document.getElementById('das-minimize').addEventListener('click', () => {
            const panel = document.getElementById('das-panel');
            panel.style.display = 'none';
            minIcon.style.display = 'flex';
            // Sync position
            minIcon.style.top = panel.style.top;
            minIcon.style.left = panel.style.left;
        });

        // Draggable
        makeDraggable(div);
        makeDraggable(minIcon);
    }

    function saveConfigFromUI() {
        const config = {
            minInterval: document.getElementById('das-min-interval').value,
            maxInterval: document.getElementById('das-max-interval').value,
            comments: document.getElementById('das-comments').value,
            randomize: document.getElementById('das-randomize').checked
        };
        saveConfig(config);
        return config;
    }

    function log(msg) {
        const logEl = document.getElementById('das-log');
        const time = new Date().toLocaleTimeString();
        logEl.innerHTML = `[${time}] ${msg}<br>` + logEl.innerHTML;
    }

    // Like Logic
    function findLikeTarget() {
        // Priority: .xgplayer-container -> video -> body
        // The container usually captures clicks for likes
        let el = document.querySelector('.xgplayer-container');
        if (!el) el = document.querySelector('video');
        // if (!el) el = document.body; 
        return el;
    }

    function startLikeLoop() {
        if (!isLiking) return;
        
        // 策略: 仅使用键盘 Z 键点赞 (用户指定)
        const keyOpts = { 
            key: 'z', 
            code: 'KeyZ', 
            keyCode: 90, 
            which: 90, 
            bubbles: true,
            cancelable: true,
            composed: true
        };
        
        // 尝试发送给播放器容器，兜底发送给 body
        // 抖音网页版通常监听 document 或播放器容器的键盘事件
        const target = document.querySelector('.xgplayer-container') || document.body;
        
        target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
        target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
        target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

        // 随机间隔 100ms - 200ms
        const delay = Math.floor(Math.random() * 100) + 100;
        
        likeTimerId = setTimeout(startLikeLoop, delay);
    }

    function toggleLiking() {
        const btn = document.getElementById('das-like-btn');
        if (isLiking) {
            isLiking = false;
            if (likeTimerId) clearTimeout(likeTimerId);
            btn.textContent = "开始点赞";
            btn.classList.remove('stop');
            log("🛑 点赞停止");
        } else {
            isLiking = true;
            btn.textContent = "停止点赞";
            btn.classList.add('stop');
            log("❤️ 开始点赞...");
            startLikeLoop();
        }
    }

    // Draggable Logic
    function makeDraggable(elmnt) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = elmnt.querySelector('.das-header') || elmnt; // Header for panel, self for icon
        
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            // Prevent default only if not clicking a button/input
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('das-toggle')) {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                // Initialize drag state
                elmnt.dataset.dragged = 'false';
                
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            
            // Mark as dragged
            elmnt.dataset.dragged = 'true';
            
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Core Logic
    function findChatInput() {
        // Try multiple selectors as Douyin updates classes frequently
        const selectors = [
            'textarea.webcast-room__chat_input_editor',
            'textarea[placeholder*="说点什么"]',
            'textarea.xgplayer-input-textarea',
            '.chat-input-container textarea',
            'div[contenteditable="true"]', // Rich text editor support
            'textarea' // Fallback to any textarea
        ];

        for (const s of selectors) {
            const el = document.querySelector(s);
            // Check if element exists, is enabled, and is visible
            if (el && !el.disabled && el.offsetParent !== null) return el;
        }
        return null;
    }

    function findSendButton() {
         // Priority 1: Specific classes
         const selectors = [
             '.webcast-room__chat_send_btn',
             'button[class*="send_btn"]',
             'button[class*="send-btn"]'
         ];
         
         for(let s of selectors) {
             let btn = document.querySelector(s);
             if(btn) return btn;
         }

         // Priority 2: Text content "发送"
         const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
         return buttons.find(b => b.textContent.trim().includes('发送'));
    }

    function setNativeValue(element, value) {
        // React/Vue hack to trigger input events properly
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

        if (valueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else {
            valueSetter.call(element, value);
        }

        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true })); 
    }

    async function sendComment(msg) {
        const input = findChatInput();
        if (!input) {
            log("❌ 未找到输入框 (请确保在直播间)");
            return false;
        }

        try {
            // 1. Focus and Click
            input.click();
            input.focus();

            // 2. Set Value
            if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
                setNativeValue(input, msg);
            } else {
                // Handle contenteditable div
                input.textContent = msg;
            }
            
            // Dispatch multiple events to wake up the UI
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 3. Wait a bit for UI to react
            await new Promise(r => setTimeout(r, 500));

            // 4. Try to find Send Button
            let btn = findSendButton();
            
            if (btn && !btn.disabled && btn.offsetParent !== null) {
                // Try mouse events sequence
                const mouseOpts = { bubbles: true, cancelable: true, view: window };
                btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
                btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
                btn.click();
                log(`✅ 点击发送: ${msg}`);
            } else {
                // Fallback to Enter key sequence
                const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                input.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
                input.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
                input.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
                log(`✅ 按键发送: ${msg}`);
            }
            return true;
        } catch (e) {
            log(`❌ 出错: ${e.message}`);
            return false;
        }
    }

    function toggleRunning() {
        const btn = document.getElementById('das-start-btn');
        if (isRunning) {
            // Stop
            isRunning = false;
            if (timerId) clearTimeout(timerId);
            btn.textContent = "开始弹幕";
            btn.classList.remove('stop');
            log("🛑 弹幕停止");
        } else {
            // Start
            const config = saveConfigFromUI();
            const comments = config.comments.split('\n').filter(line => line.trim() !== '');

            if (comments.length === 0) {
                alert("请先输入弹幕内容！");
                return;
            }

            isRunning = true;
            btn.textContent = "停止弹幕";
            btn.classList.add('stop');
            log("🚀 开始弹幕...");

            scheduleNext(config, comments);
        }
    }

    function scheduleNext(config, comments) {
        if (!isRunning) return;

        let msg;
        if (config.randomize) {
             msg = comments[Math.floor(Math.random() * comments.length)];
        } else {
             msg = comments[currentIndex];
             currentIndex = (currentIndex + 1) % comments.length;
        }

        sendComment(msg);

        // Calculate next interval (randomized between min and max)
        const minMs = parseFloat(config.minInterval) * 1000;
        const maxMs = parseFloat(config.maxInterval) * 1000;
        
        // Ensure max >= min
        const safeMax = Math.max(maxMs, minMs);
        
        const nextDelay = Math.floor(Math.random() * (safeMax - minMs + 1) + minMs);
        
        log(`⏳ 下次发送: ${(nextDelay/1000).toFixed(1)}秒后`);

        timerId = setTimeout(() => {
            scheduleNext(config, comments);
        }, nextDelay);
    }

    // Init
    window.addEventListener('load', () => {
        setTimeout(createUI, 2000); // Delay to let page load
    });

})();
