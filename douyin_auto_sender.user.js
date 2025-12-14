// ==UserScript==
// @name         Douyin Auto Sender (抖音直播自动弹幕助手)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Automated comment sender for Douyin Live with custom presets and random intervals.
// @author       AutoTikTokSendComment Project
// @match        *://*/*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIgZmlsbD0iIzAwMCIvPjxwYXRoIGQ9Ik0zMCA3MGgyMHYyMEgzMHoiIGZpbGw9IiNmZmYiLz48cGF0aCBkPSJNMzAgMzBoMjB2MjBIMzB6IiBmaWxsPSIjZmZmIi8+PC9zdmc+
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        window.onurlchange
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // Safety Check: Ensure we are on Douyin
    if (!location.hostname.includes('douyin.com')) {
        return;
    }

    console.log("✅ Douyin Auto Sender V2.3: Script injected successfully on " + location.href);

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
    let countdownTimerId = null; // For the visual countdown
    let likeTimerId = null;
    let currentIndex = 0;
    
    // For Shuffle Logic
    let playQueue = [];
    let queueIndex = 0;

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
        if (document.getElementById('das-panel')) return; // Avoid duplicates

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
                
                <!-- Status Display for Countdown & Next Message -->
                <div class="das-status-display" id="das-status-box" style="display: none;">
                    <div class="das-status-row">
                        <span class="das-label">即将发送:</span>
                        <span id="das-next-msg" class="das-value text-ellipsis">-</span>
                    </div>
                    <div class="das-status-row">
                        <span class="das-label">倒计时:</span>
                        <span id="das-countdown" class="das-value highlight">0</span>
                        <span class="das-unit">秒</span>
                    </div>
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
                width: 260px;
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
            
            /* Status Display Styles */
            .das-status-display {
                margin-bottom: 10px;
                padding: 8px;
                background: #2a2a2a;
                border-radius: 4px;
                border: 1px solid #444;
            }
            .das-status-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .das-status-row:last-child { margin-bottom: 0; }
            .das-label { color: #aaa; }
            .das-value { font-weight: bold; color: #fff; max-width: 150px; }
            .text-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .highlight { color: #00e676; font-size: 14px; }
            .das-unit { color: #aaa; font-size: 10px; margin-left: 2px; }

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
            if (minIcon.dataset.dragged === 'true') {
                minIcon.dataset.dragged = 'false';
                return;
            }
            minIcon.style.display = 'none';
            const panel = document.getElementById('das-panel');
            panel.style.display = 'block';
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
        let el = document.querySelector('.xgplayer-container');
        if (!el) el = document.querySelector('video');
        return el;
    }

    function startLikeLoop() {
        if (!isLiking) return;
        
        const keyOpts = { 
            key: 'z', 
            code: 'KeyZ', 
            keyCode: 90, 
            which: 90, 
            bubbles: true,
            cancelable: true,
            composed: true
        };
        
        const target = document.querySelector('.xgplayer-container') || document.body;
        
        target.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
        target.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
        target.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

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
        const header = elmnt.querySelector('.das-header') || elmnt;
        
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.classList.contains('das-toggle')) {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                elmnt.dataset.dragged = 'false';
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
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
        const selectors = [
            'textarea.webcast-room__chat_input_editor',
            'textarea[placeholder*="说点什么"]',
            'textarea.xgplayer-input-textarea',
            '.chat-input-container textarea',
            'div[contenteditable="true"]', 
            'textarea' 
        ];

        for (const s of selectors) {
            const el = document.querySelector(s);
            if (el && !el.disabled && el.offsetParent !== null) return el;
        }
        return null;
    }

    function findSendButton() {
         const selectors = [
             '.webcast-room__chat_send_btn',
             'button[class*="send_btn"]',
             'button[class*="send-btn"]'
         ];
         
         for(let s of selectors) {
             let btn = document.querySelector(s);
             if(btn) return btn;
         }

         const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
         return buttons.find(b => b.textContent.trim().includes('发送'));
    }

    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value');
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value');

        if (prototypeValueSetter && prototypeValueSetter.set && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.set.call(element, value);
        } else if (valueSetter && valueSetter.set) {
            valueSetter.set.call(element, value);
        } else {
            element.value = value;
        }

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

            // FIX: Clear input first to prevent empty lines or appended text
            // Only use setNativeValue for input/textarea
            if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
                setNativeValue(input, '');
            } else {
                input.textContent = '';
            }
            
            await new Promise(r => setTimeout(r, 100));

            // 2. Set Value
            if (input.tagName.toLowerCase() === 'textarea' || input.tagName.toLowerCase() === 'input') {
                setNativeValue(input, msg);
            } else {
                input.textContent = msg;
            }
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 3. Wait a bit for UI to react (Increased delay to prevent stuck issues)
            await new Promise(r => setTimeout(r, 800));

            // 4. Try to find Send Button
            let btn = findSendButton();
            
            // FIX: Retry finding button if disabled or missing
            if (btn && btn.disabled) {
                // Wait a bit more if disabled
                await new Promise(r => setTimeout(r, 500));
                btn = findSendButton();
            }

            let sentByButton = false;
            if (btn && !btn.disabled) {
                // Remove offsetParent check to allow sending when window is minimized/hidden
                const mouseOpts = { bubbles: true, cancelable: true, view: window };
                btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
                await new Promise(r => setTimeout(r, 50)); // Small delay between down/up
                btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
                btn.click();
                sentByButton = true;
            }

            // 5. Verification & Fallback (Critical for background tabs)
            // Wait to see if input is cleared (success signal)
            await new Promise(r => setTimeout(r, 500));
            
            const currentVal = (input.value || input.textContent || '').trim();
            
            if (currentVal.length > 0) {
                if (sentByButton) {
                    log("⚠️ 按钮发送可能失败 (内容未清空)，尝试回车补发...");
                }
                
                const keyOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
                input.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
                input.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
                input.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
                
                // Final check
                await new Promise(r => setTimeout(r, 500));
                const finalVal = (input.value || input.textContent || '').trim();
                if (finalVal.length > 0) {
                    log(`❌ 发送失败: 内容仍残留`);
                    return false;
                } else {
                    log(`✅ 按键补发成功: ${msg}`);
                    return true;
                }
            } else {
                log(`✅ 发送成功: ${msg}`);
                return true;
            }
        } catch (e) {
            log(`❌ 出错: ${e.message}`);
            return false;
        }
    }

    function toggleRunning() {
        const btn = document.getElementById('das-start-btn');
        const statusBox = document.getElementById('das-status-box');
        
        if (isRunning) {
            // Stop
            isRunning = false;
            if (timerId) clearTimeout(timerId);
            if (countdownTimerId) clearInterval(countdownTimerId);
            
            btn.textContent = "开始弹幕";
            btn.classList.remove('stop');
            statusBox.style.display = 'none'; // Hide status
            log("🛑 弹幕停止");
        } else {
            // Start
            const config = saveConfigFromUI();
            
            // Robust parsing: handle \n, \r\n, \r
            const comments = config.comments
                .split(/[\r\n]+/)
                .map(line => line.trim())
                .filter(line => line !== '');

            if (comments.length === 0) {
                alert("请先输入弹幕内容！");
                return;
            }

            // Safety Warning if parsing seems wrong (e.g. single long line)
            if (comments.length === 1 && comments[0].length > 50) {
                 const confirmSend = confirm(`⚠️ 检测到只有 1 条弹幕，且内容较长（${comments[0].length}字）。\n\n如果这是多条弹幕，请确保使用【回车换行】分隔。\n\n是否继续发送？`);
                 if (!confirmSend) return;
            }

            isRunning = true;
            btn.textContent = "停止弹幕";
            btn.classList.add('stop');
            statusBox.style.display = 'block'; // Show status
            log(`🚀 开始弹幕... (共 ${comments.length} 条)`);

            // Initialize Shuffle/Sequence Queue
            initQueue(config, comments);

            // Get first message
            const firstMsg = getNextMessage(config, comments);
            
            // Start the cycle with the first message
            performSendCycle(config, comments, firstMsg);
        }
    }

    // Shuffle helper
    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        // While there remain elements to shuffle.
        while (currentIndex != 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    function initQueue(config, comments) {
        if (config.randomize) {
            // Clone and shuffle
            playQueue = shuffleArray([...comments]);
            queueIndex = 0;
            log(`🔀 随机模式: 已打乱 ${playQueue.length} 条弹幕顺序`);
        } else {
            // Sequence mode
            playQueue = comments;
            queueIndex = 0; // Or keep previous index? Better reset for clear start
            log(`▶️ 顺序模式: 共 ${playQueue.length} 条弹幕`);
        }
    }

    function getNextMessage(config, comments) {
        if (!isRunning) return null;

        if (config.randomize) {
            // Check if we reached end of shuffle queue
            if (queueIndex >= playQueue.length) {
                log("🔄 一轮发送完毕，重新洗牌...");
                playQueue = shuffleArray([...comments]);
                queueIndex = 0;
            }
            return playQueue[queueIndex++];
        } else {
            // Sequence logic
            const msg = comments[queueIndex];
            queueIndex = (queueIndex + 1) % comments.length;
            return msg;
        }
    }

    function performSendCycle(config, comments, currentMsg) {
        if (!isRunning) return;

        // 1. Prepare NEXT message for display (Pre-fetch)
        // We need to peek/get the next one NOW to show it in UI
        // But be careful not to consume it if we use getNextMessage (it increments index)
        // Actually, our getNextMessage increments index, so calling it means "scheduling it".
        // Let's get it.
        const nextMsg = getNextMessage(config, comments);
        
        // 2. Send CURRENT message
        sendComment(currentMsg).then(() => {
            if (!isRunning) return;

            // 3. Calculate delay
            const minMs = parseFloat(config.minInterval) * 1000;
            const maxMs = parseFloat(config.maxInterval) * 1000;
            const safeMax = Math.max(maxMs, minMs);
            const nextDelay = Math.floor(Math.random() * (safeMax - minMs + 1) + minMs);

            // 4. Update UI with NEXT message and start countdown
            startCountdown(nextDelay, nextMsg, () => {
                 // 5. Recursion: Next becomes Current
                 performSendCycle(config, comments, nextMsg);
            });
        });
    }

    function startCountdown(durationMs, nextMsg, callback) {
        if (!isRunning) return;

        const nextMsgEl = document.getElementById('das-next-msg');
        const countdownEl = document.getElementById('das-countdown');
        
        if (nextMsgEl) nextMsgEl.textContent = nextMsg;
        
        let remaining = durationMs / 1000;
        
        // Initial Display
        if (countdownEl) countdownEl.textContent = remaining.toFixed(1);
        
        // Update UI
        if (countdownTimerId) clearInterval(countdownTimerId);
        
        const startTime = Date.now();
        const endTime = startTime + durationMs;

        countdownTimerId = setInterval(() => {
            if (!isRunning) {
                clearInterval(countdownTimerId);
                return;
            }

            const now = Date.now();
            const left = Math.max(0, endTime - now);
            const secondsLeft = (left / 1000).toFixed(1);
            
            if (countdownEl) countdownEl.textContent = secondsLeft;

            if (left <= 0) {
                clearInterval(countdownTimerId);
                callback();
            }
        }, 100);
        
        log(`⏳ 下次发送: ${remaining.toFixed(1)}秒后`);
    }

    // Auto-init and URL monitoring
    function init() {
        if (document.getElementById('das-panel')) return;
        console.log("✅ Douyin Auto Sender: Attempting to create UI...");
        createUI();
    }

    // Monitor URL changes for SPA
    if (window.onurlchange === null) {
        window.addEventListener('urlchange', (info) => {
            console.log("✅ URL changed (Native):", info.url);
            setTimeout(createUI, 1000);
        });
    } else {
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                console.log("✅ URL changed (Mutation):", url);
                setTimeout(createUI, 1000);
            }
        }).observe(document, {subtree: true, childList: true});
    }

    // Initial load
    init();
    
    // Backup init
    setTimeout(init, 2000);
    setTimeout(init, 5000);

})();
