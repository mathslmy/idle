import {
    saveSettingsDebounced,
    substituteParams,
} from '../../../../script.js';
import { debounce } from '../../../utils.js';
import { promptQuietForLoudResponse, sendNarratorMessage } from '../../../slash-commands.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { registerSlashCommand } from '../../../slash-commands.js';
const extensionName = 'third-party/Extension-Idle';
// 修改 defaultSettings
let defaultSettings = {
    enabled: false,
    timer: 120,
    prompts: [
        '*stands silently, looking deep in thought*',
        '*pauses, eyes wandering over the surroundings*',
    ],
    randomTime: false,
    timerMin: 60,
    includePrompt: false,
    scheduleOnceList: [],
    scheduleDailyList: [],
    useIdleTimer: true,
    sendAs: 'user',
    lastAIReplyTime: null,
    
    characterInfo: {
        charName: '',
        userName: '',
        chatFilePath: '',
        charDescription: '',
        userDescription: ''
    },
    
    // 新增配置
    apiConfig: {
        url: '',
        key: '',
        model: ''
    },
    chatCount: 10,
    regexList: [],
    headPrompts: [],
    endPrompts: [],
    worldbookList: []  // 🔥 改为 worldbookList，结构与 regexList 相同
};
// 修改 settingsHTML
const settingsHTML = `
<div id="idle_container" class="extension-container">
    <details>
        <summary><b>Idle Settings (主动回复模式)</b></summary>
        
        <!-- 后端状态显示 -->
        <fieldset style="border: 2px solid #4a90e2; margin-bottom: 10px;">
            <legend style="font-weight: bold; color: #4a90e2;">🔧 后端服务状态</legend>
            <div style="padding: 10px;">
                <div id="idle_backend_status" style="font-size: 14px; padding: 5px; color: #999;">
                    未连接
                </div>
                <button type="button" id="idle_reconnect_backend" style="margin-top: 5px; padding: 5px 10px;">
                    重新连接
                </button>
                <button type="button" id="idle_test_notification" style="margin-left: 5px; padding: 5px 10px;">
                    测试通知
                </button>
                <button type="button" id="idle_manual_trigger" style="margin-left: 5px; padding: 5px 10px;">
                    手动触发回复
                </button>
                <button type="button" id="idle_sync_now" style="margin-left: 5px; padding: 5px 10px; background: #28a745; color: white;">
                    立即同步配置
                </button>
            </div>
        </fieldset>
        
        <!-- API配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>API配置（独立）</legend>
            <div style="display: grid; gap: 8px;">
                <label>
                    API URL:
                    <input type="text" id="idle_api_url" placeholder="http://localhost:5001">
                </label>
                <label>
                    API Key:
                    <input type="password" id="idle_api_key" placeholder="sk-...">
                </label>
                <label>
                    Model:
                    <input type="text" id="idle_api_model" placeholder="deepseek-reasoner">
                </label>
            </div>
        </fieldset>
        
        <!-- 额外提示词配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>额外提示词配置</legend>
            <div style="display: grid; gap: 8px;">
                <label>
                    Head Prompts (前置提示):
                    <textarea id="idle_head_prompts" rows="3" placeholder="在每次对话前附加的提示"></textarea>
                </label>
                <label>
                    End Prompts (后置提示):
                    <textarea id="idle_end_prompts" rows="3" placeholder="在每次对话后附加的提示"></textarea>
                </label>
            </div>
        </fieldset>
        
        <!-- 角色信息配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>角色信息配置</legend>
            <div style="display: grid; gap: 8px;">
                <label>
                    角色名 ({{char}}):
                    <input type="text" id="idle_char_name" placeholder="输入角色名">
                </label>
                <label>
                    角色描述 (Character Description):
                    <textarea id="idle_char_description" rows="3" placeholder="角色的详细描述"></textarea>
                </label>
                <label>
                    用户名 ({{user}}):
                    <input type="text" id="idle_user_name" placeholder="输入用户名">
                </label>
                <label>
                    用户描述 (User Description):
                    <textarea id="idle_user_description" rows="3" placeholder="用户的详细描述"></textarea>
                </label>
                <label>
                    聊天文件路径:
                    <input type="text" id="idle_chat_path" placeholder="chats/角色名/聊天文件名.jsonl">
                    <small style="color: #666;">示例: chats/Alice/conversation_2024.jsonl</small>
                </label>
            </div>
        </fieldset>
        
        <!-- 🔥 世界书配置 - 改为列表形式 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>世界书配置</legend>
            <div>
                <h4>世界书列表</h4>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <input type="text" id="idle_new_worldbook" placeholder="世界书文件名" style="flex: 1;">
                    <button type="button" id="idle_add_worldbook">添加</button>
                </div>
                <div id="idle_worldbook_list" style="max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 6px; border-radius: 6px;"></div>
                <small style="color: #666;">后端将读取这些世界书中所有未禁用(disable=false)的条目</small>
            </div>
        </fieldset>
        
        <!-- 聊天记录配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>聊天记录处理</legend>
            <div style="margin-bottom: 10px;">
                <label>
                    读取条数: <span id="idle_chat_count_value">10</span>
                    <input type="range" id="idle_chat_count" min="0" max="20" value="10" style="width: 100%;">
                </label>
            </div>
            <div>
                <h4>正则修剪列表</h4>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <input type="text" id="idle_new_regex" placeholder="<example></example>" style="flex: 1;">
                    <button type="button" id="idle_add_regex">添加</button>
                </div>
                <div id="idle_regex_list" style="max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 6px; border-radius: 6px;"></div>
            </div>
        </fieldset>
        
        <!-- General Settings -->
        <fieldset>
            <legend>General Settings</legend>
            <label>
                <input type="checkbox" id="idle_enabled">
                Enable Idle
            </label>
            <div>
                <label for="idle_sendAs">Send As:</label>
                <select id="idle_sendAs">
                    <option value="user">User</option>
                    <option value="char">Character</option>
                    <option value="sys">System</option>
                    <option value="raw">Raw</option>
                </select>
            </div>
            <div>
                <label>
                    <input type="checkbox" id="idle_include_prompt">
                    Include Prompt in Message
                </label>
            </div>
            <div class="idle-next-time">
                Next event scheduled: <span id="idle_next_time">--</span>
            </div>
        </fieldset>
        
        <!-- Idle Behaviors -->
        <fieldset>
            <legend>Idle Behaviors</legend>
            <div>
                <label>
                    <input type="checkbox" id="idle_use_timer">
                    Enable Idle Reply
                </label>
            </div>
            <div>
                <label>
                    <input type="checkbox" id="idle_random_time">
                    Use Random Time
                </label>
            </div>
            <div>
                <label for="idle_timer">Idle Timer (seconds):</label>
                <input type="number" id="idle_timer" min="1">
            </div>
            <div>
                <label for="idle_timer_min">Idle Timer Minimum (when random):</label>
                <input type="number" id="idle_timer_min" min="1">
            </div>
            <div>
                <label for="idle_prompts">Prompts (one per line):</label>
                <textarea id="idle_prompts" rows="5"></textarea>
            </div>
            
            <!-- One-Time Schedules -->
            <fieldset>
                <legend>One-Time Schedules</legend>
                <div id="idle_schedule_once_list"></div>
                <button type="button" id="idle_add_schedule_once">+ Add One-Time Schedule</button>
            </fieldset>
            
            <!-- Daily Schedules -->
            <fieldset>
                <legend>Daily Schedules</legend>
                <div id="idle_schedule_daily_list"></div>
                <button type="button" id="idle_add_schedule_daily">+ Add Daily Schedule</button>
            </fieldset>
        </fieldset>
    </details>
</div>
`;
// 🔥 添加世界书列表管理函数
function renderWorldbookList() {
    const container = $('#idle_worldbook_list');
    container.empty();
    
    const worldbookList = extension_settings.idle.worldbookList || [];
    
    if (worldbookList.length === 0) {
        container.append('<div style="color: #999; padding: 10px; text-align: center;">暂无世界书</div>');
        return;
    }
    
    worldbookList.forEach((item, idx) => {
        const div = $('<div>').css({
            display: 'flex',
            alignItems: 'center',
            marginBottom: '4px',
            gap: '4px'
        });
        
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .prop('checked', item.enabled)
            .on('change', function() {
                worldbookList[idx].enabled = this.checked;
                extension_settings.idle.worldbookList = worldbookList;
                saveSettingsDebounced();
                if (idleBackendClient && idleBackendClient.isConnected) {
                    idleBackendClient.syncAllData();
                }
            });
        
        const text = $('<span>')
            .text(item.name)
            .css({ flex: '1', wordBreak: 'break-all' });
        
        const editBtn = $('<button>')
            .text('编辑')
            .on('click', () => {
                const newVal = prompt('编辑世界书名称', item.name);
                if (newVal !== null && newVal.trim()) {
                    worldbookList[idx].name = newVal.trim();
                    extension_settings.idle.worldbookList = worldbookList;
                    saveSettingsDebounced();
                    renderWorldbookList();
                    if (idleBackendClient && idleBackendClient.isConnected) {
                        idleBackendClient.syncAllData();
                    }
                }
            });
        
        const delBtn = $('<button>')
            .text('删除')
            .on('click', () => {
                worldbookList.splice(idx, 1);
                extension_settings.idle.worldbookList = worldbookList;
                saveSettingsDebounced();
                renderWorldbookList();
                if (idleBackendClient && idleBackendClient.isConnected) {
                    idleBackendClient.syncAllData();
                }
            });
        
        div.append(checkbox, text, editBtn, delBtn);
        container.append(div);
    });
}
// 添加正则列表管理函数
function renderRegexList() {
    const container = $('#idle_regex_list');
    container.empty();
    
    const regexList = extension_settings.idle.regexList || [];
    
    if (regexList.length === 0) {
        container.append('<div style="color: #999; padding: 10px; text-align: center;">暂无正则规则</div>');
        return;
    }
    
    regexList.forEach((item, idx) => {
        const div = $('<div>').css({
            display: 'flex',
            alignItems: 'center',
            marginBottom: '4px',
            gap: '4px'
        });
        
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .prop('checked', item.enabled)
            .on('change', function() {
                regexList[idx].enabled = this.checked;
                extension_settings.idle.regexList = regexList;
                saveSettingsDebounced();
                if (idleBackendClient && idleBackendClient.isConnected) {
                    idleBackendClient.syncAllData();
                }
            });
        
        const text = $('<span>')
            .text(item.pattern)
            .css({ flex: '1', wordBreak: 'break-all' });
        
        const editBtn = $('<button>')
            .text('编辑')
            .on('click', () => {
                const newVal = prompt('编辑正则', item.pattern);
                if (newVal !== null) {
                    regexList[idx].pattern = newVal;
                    extension_settings.idle.regexList = regexList;
                    saveSettingsDebounced();
                    renderRegexList();
                    if (idleBackendClient && idleBackendClient.isConnected) {
                        idleBackendClient.syncAllData();
                    }
                }
            });
        
        const delBtn = $('<button>')
            .text('删除')
            .on('click', () => {
                regexList.splice(idx, 1);
                extension_settings.idle.regexList = regexList;
                saveSettingsDebounced();
                renderRegexList();
                if (idleBackendClient && idleBackendClient.isConnected) {
                    idleBackendClient.syncAllData();
                }
            });
        
        div.append(checkbox, text, editBtn, delBtn);
        container.append(div);
    });
}
// ========================================
// === 后端客户端 ===
// ========================================
class IdleBackendClient {
    constructor() {
        this.eventSource = null;
        this.isConnected = false;
        this.backendUrl = 'http://localhost:8765';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 999;
        this.syncInterval = null;
    }
    connect() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        console.log('[Idle Backend] Connecting to', this.backendUrl);
        toastr.info('正在连接后端服务...', 'Idle Extension');
        this.eventSource = new EventSource(`${this.backendUrl}/events`);
        this.eventSource.onopen = () => {
            console.log('[Idle Backend] ✓ Connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            toastr.success('后端服务已连接 - 主动回复模式', 'Idle Extension');
            $('#idle_backend_status').html('✓ 后端运行中').css('color', '#4a90e2');
            
            this.syncAllData();
            
            if (this.syncInterval) clearInterval(this.syncInterval);
            this.syncInterval = setInterval(() => this.syncAllData(), 30000);
        };
        this.eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (err) {
                console.error('[Idle Backend] Parse error:', err);
            }
        };
        this.eventSource.onerror = (err) => {
            console.error('[Idle Backend] Connection error');
            this.isConnected = false;
            $('#idle_backend_status').html('✗ 后端断开').css('color', '#999');
            
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
                this.syncInterval = null;
            }
            
            this.eventSource.close();
            this.attemptReconnect();
        };
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            toastr.error('无法连接到后端服务', 'Idle Extension');
            return;
        }
        this.reconnectAttempts++;
        console.log(`[Idle Backend] Reconnecting... (${this.reconnectAttempts})`);
        setTimeout(() => {
            this.connect();
        }, 5000);
    }
    handleMessage(message) {
        console.log('[Idle Backend] Message:', message.type);
        switch (message.type) {
            case 'CONNECTED':
                console.log('[Idle Backend] Initial state received');
                if (message.data.nextTrigger) {
                    this.updateNextTimeUI(message.data.nextTrigger);
                    localStorage.setItem('idle_next_trigger_time', message.data.nextTrigger);
                }
                break;
            case 'NEXT_TIME_UPDATE':
                if (message.data.remainingSeconds !== undefined) {
                    const remaining = message.data.remainingSeconds;
                    const nextTime = new Date(message.data.nextTriggerTime);
                    const timeStr = nextTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                    $('#idle_next_time').html(`${timeStr} <span style="color: #666;">(${remaining}秒后)</span>`);
                    
                    localStorage.setItem('idle_next_trigger_time', message.data.nextTriggerTime);
                }
                break;
            case 'IDLE_TRIGGER':
            case 'SCHEDULE_ONCE_TRIGGER':
            case 'SCHEDULE_DAILY_TRIGGER':
                console.log('[Idle Backend] ⏰ 后端主动回复完成!');
                toastr.success('后端已自动回复', 'Idle Extension');
                $('#idle_next_time').text('等待下次触发...');
                try {
                    let count = parseInt(localStorage.getItem('idle_trigger_count') || '0');
                    count += 1;
                    localStorage.setItem('idle_trigger_count', count.toString());
                    console.log(`[Idle Backend] 触发计数 +1，当前计数: ${count}`);
                    if (window.idleRefreshTimer) {
                        console.log('[Idle Backend] 已存在刷新任务，跳过重复设置');
                        break;
                    }
                    window.idleRefreshTimer = setTimeout(() => {
                        const triggerCount = parseInt(localStorage.getItem('idle_trigger_count') || '0');
                        if (triggerCount > 0) {
                            console.log(`[Idle Backend] 🚀 执行刷新（累计触发 ${triggerCount} 次）`);
                            toastr.info('检测到后端自动回复，页面即将刷新...', 'Idle Extension');
                            localStorage.setItem('idle_trigger_count', '0');
                            window.idleRefreshTimer = null;
                            location.reload();
                        } else {
                            console.log('[Idle Backend] 没有待处理触发，取消刷新');
                            window.idleRefreshTimer = null;
                        }
                    }, 5000);
                } catch (err) {
                    console.warn('[Idle Backend] 刷新计数逻辑出错:', err);
                    window.idleRefreshTimer = null;
                    localStorage.setItem('idle_trigger_count', '0');
                }
                break;
        }
    }
    updateNextTimeUI(nextTrigger) {
        if (!nextTrigger || !nextTrigger.triggerTime) return;
        const nextTime = new Date(nextTrigger.triggerTime);
        const timeStr = nextTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        $('#idle_next_time').text(timeStr);
    }
    // 🔥 简化的同步数据收集
    async collectSyncData() {
        // 1. API配置
        const apiConfig = {
            url: $('#idle_api_url').val() || '',
            key: $('#idle_api_key').val() || '',
            model: $('#idle_api_model').val() || ''
        };
        
        // 2. 角色信息
        const characterInfo = {
            charName: $('#idle_char_name').val() || '',
            userName: $('#idle_user_name').val() || '',
            chatFilePath: $('#idle_chat_path').val() || '',
            charDescription: $('#idle_char_description').val() || '',
            userDescription: $('#idle_user_description').val() || ''
        };
        
        // 3. 预设数据（从前端获取）
        const presetData = await this.getPresetData();
        
        // 4. Idle提示词
        const idlePrompts = $('#idle_prompts').val().split('\n').filter(p => p.trim());
        
        // 5. 正则配置
        const regexList = extension_settings.idle.regexList || [];
        
        // 6. Head/End Prompts
        const headPrompts = $('#idle_head_prompts').val().split('\n').filter(p => p.trim());
        const endPrompts = $('#idle_end_prompts').val().split('\n').filter(p => p.trim());
        
        // 7. 🔥 世界书列表 - 只传递启用的世界书名称
        const worldbookList = extension_settings.idle.worldbookList || [];
        const worldbookNames = worldbookList
            .filter(wb => wb.enabled)
            .map(wb => wb.name);
        
        // 8. 聊天记录条数
        const chatCount = parseInt($('#idle_chat_count').val()) || 10;
        
        return {
            ...extension_settings.idle,
            apiConfig,
            characterInfo,
            presetData,
            idlePrompts,
            regexList,
            headPrompts,
            endPrompts,
            worldbookNames,  // 传递给后端的是名称数组
            chatCount
        };
    }
    // 获取预设数据（保留前端逻辑）
    async getPresetData() {
        try {
            const ctx = SillyTavern.getContext();
            const { getPresetManager } = ctx;
            const pm = getPresetManager();
            
            const preset = pm.getSelectedPreset();
            return preset;
        } catch (e) {
            console.error('获取预设失败:', e);
            
            try {
                const response = await fetch('/scripts/extensions/third-party/Extension-Idle/鹿_mr_鹿鹿预设_Code_3_0.json');
                return await response.json();
            } catch (fallbackError) {
                console.error('加载兜底预设失败:', fallbackError);
                return null;
            }
        }
    }
    async syncAllData() {
        if (!this.isConnected) {
            console.warn('[Idle Backend] Not connected, skip sync');
            return;
        }
        try {
            const syncData = await this.collectSyncData();
            await this.syncSettings(syncData);
            console.log('[Idle Backend] ✓ All data synced');
        } catch (err) {
            console.error('[Idle Backend] Sync failed:', err);
        }
    }
    async syncSettings(settings) {
        if (!this.isConnected) {
            console.warn('[Idle Backend] Not connected, cannot sync settings');
            return;
        }
        try {
            const response = await fetch(`${this.backendUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('[Idle Backend] Settings synced');
            }
        } catch (err) {
            console.error('[Idle Backend] Failed to sync settings:', err);
        }
    }
    async notifyAIReply() {
        if (!this.isConnected) return;
        try {
            await fetch(`${this.backendUrl}/api/ai-reply`, {
                method: 'POST'
            });
            console.log('[Idle Backend] AI reply notified');
        } catch (err) {
            console.error('[Idle Backend] Failed to notify AI reply:', err);
        }
    }
    async testNotification() {
        if (!this.isConnected) {
            toastr.error('后端未连接', 'Idle Extension');
            return;
        }
        try {
            const testSettings = {
                ...extension_settings.idle,
                enabled: true,
                lastAIReplyTime: new Date(Date.now() - 1000).toISOString(),
                timer: 0
            };
            await this.syncSettings(testSettings);
            toastr.success('测试通知已发送', 'Idle Extension');
            setTimeout(async () => {
                await this.syncSettings(extension_settings.idle);
            }, 2000);
        } catch (err) {
            toastr.error('测试失败：' + err.message, 'Idle Extension');
        }
    }
    async manualTrigger() {
        if (!this.isConnected) {
            toastr.error('后端未连接', 'Idle Extension');
            return;
        }
        try {
            toastr.info('正在触发主动回复...', 'Idle Extension');
            
            const response = await fetch(`${this.backendUrl}/api/trigger-reply`, {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.success) {
                toastr.success('主动回复成功！2秒后刷新页面', 'Idle Extension');
                setTimeout(() => location.reload(), 2000);
            } else {
                toastr.error('主动回复失败: ' + result.error, 'Idle Extension');
            }
        } catch (err) {
            toastr.error('触发失败：' + err.message, 'Idle Extension');
        }
    }
    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        this.isConnected = false;
    }
}
// 全局后端客户端实例
let idleBackendClient = null;
// ========================================
// === AI 回复监听器 ===
// ========================================
function setupAIReplyMonitor() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('mes') && 
                    !node.classList.contains('user_mes')) {
                    
                    extension_settings.idle.lastAIReplyTime = new Date().toISOString();
                    saveSettingsDebounced();
                    
                    if (idleBackendClient && idleBackendClient.isConnected) {
                        idleBackendClient.notifyAIReply();
                        console.log('[Idle Extension] AI reply detected, notified backend');
                    }
                }
            });
        });
    });
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
        console.log('[Idle Extension] AI reply monitor started');
    }
}
// ========================================
// === 其他函数 ===
// ========================================
async function loadSettings() {
    if (!extension_settings.idle) {
        extension_settings.idle = {};
    }
    
    console.log('[Idle Extension] Loading settings...');
    
    // 合并默认设置
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.idle.hasOwnProperty(key)) {
            extension_settings.idle[key] = Array.isArray(value) ? [...value] : 
                                          (typeof value === 'object' && value !== null ? {...value} : value);
        }
    }
    
    // 确保嵌套对象完整
    if (!extension_settings.idle.characterInfo || typeof extension_settings.idle.characterInfo !== 'object') {
        extension_settings.idle.characterInfo = { ...defaultSettings.characterInfo };
    } else {
        for (const [key, value] of Object.entries(defaultSettings.characterInfo)) {
            if (!extension_settings.idle.characterInfo.hasOwnProperty(key)) {
                extension_settings.idle.characterInfo[key] = value;
            }
        }
    }
    
    if (!extension_settings.idle.apiConfig || typeof extension_settings.idle.apiConfig !== 'object') {
        extension_settings.idle.apiConfig = { ...defaultSettings.apiConfig };
    } else {
        for (const [key, value] of Object.entries(defaultSettings.apiConfig)) {
            if (!extension_settings.idle.apiConfig.hasOwnProperty(key)) {
                extension_settings.idle.apiConfig[key] = value;
            }
        }
    }
    
    // 🔥 严格确保所有数组字段
    const arrayFields = ['regexList', 'headPrompts', 'endPrompts', 'worldbookList', 'scheduleOnceList', 'scheduleDailyList', 'prompts'];
    
    for (const field of arrayFields) {
        if (!Array.isArray(extension_settings.idle[field])) {
            extension_settings.idle[field] = Array.isArray(defaultSettings[field]) ? 
                [...defaultSettings[field]] : [];
            console.log(`[Idle Extension] Fixed array field: ${field}`);
        }
    }
    
    // 🔥 兼容旧版 worldbookNames
    if (extension_settings.idle.worldbookNames && Array.isArray(extension_settings.idle.worldbookNames)) {
        console.log('[Idle Extension] Migrating worldbookNames to worldbookList');
        extension_settings.idle.worldbookList = extension_settings.idle.worldbookNames.map(name => ({
            name: name,
            enabled: true
        }));
        delete extension_settings.idle.worldbookNames;
        saveSettingsDebounced();
    }
    
    console.log('[Idle Extension] Worldbook list loaded:', extension_settings.idle.worldbookList);
    
    populateUIWithSettings();
}
function populateUIWithSettings() {
    console.log('[Idle Extension] Populating UI with settings...');
    
    // General settings
    $('#idle_timer').val(extension_settings.idle.timer);
    $('#idle_prompts').val((extension_settings.idle.prompts || []).join('\n'));
    $('#idle_enabled').prop('checked', extension_settings.idle.enabled);
    $('#idle_random_time').prop('checked', extension_settings.idle.randomTime);
    $('#idle_timer_min').val(extension_settings.idle.timerMin);
    $('#idle_include_prompt').prop('checked', extension_settings.idle.includePrompt);
    $('#idle_sendAs').val(extension_settings.idle.sendAs || 'user');
    $('#idle_use_timer').prop('checked', extension_settings.idle.useIdleTimer);
    
    // Head/End Prompts
    const headPrompts = extension_settings.idle.headPrompts || [];
    const endPrompts = extension_settings.idle.endPrompts || [];
    $('#idle_head_prompts').val(headPrompts.join('\n'));
    $('#idle_end_prompts').val(endPrompts.join('\n'));
    
    // 角色信息
    const charInfo = extension_settings.idle.characterInfo || {};
    $('#idle_char_name').val(charInfo.charName || '');
    $('#idle_char_description').val(charInfo.charDescription || '');
    $('#idle_user_name').val(charInfo.userName || '');
    $('#idle_user_description').val(charInfo.userDescription || '');
    $('#idle_chat_path').val(charInfo.chatFilePath || '');
    
    // API配置
    const apiConfig = extension_settings.idle.apiConfig || {};
    $('#idle_api_url').val(apiConfig.url || '');
    $('#idle_api_key').val(apiConfig.key || '');
    $('#idle_api_model').val(apiConfig.model || '');
    
    // 聊天记录配置
    const chatCount = extension_settings.idle.chatCount || 10;
    $('#idle_chat_count').val(chatCount);
    $('#idle_chat_count_value').text(chatCount);
    
    renderSchedules();
    renderRegexList();
    renderWorldbookList();  // 🔥 渲染世界书列表
    
    console.log('[Idle Extension] Settings populated from storage');
}
async function loadSettingsHTML() {
    const getContainer = () => $(document.getElementById('idle_container') ?? document.getElementById('extensions_settings2'));
    getContainer().append(settingsHTML);
}
function updateSetting(elementId, property, isCheckbox = false) {
    let value = $(`#${elementId}`).val();
    if (isCheckbox) {
        value = $(`#${elementId}`).prop('checked');
    }
    if (property === 'prompts') {
        value = value.split('\n').filter(p => p.trim());
    }
    if (property === 'headPrompts' || property === 'endPrompts') {
        value = value.split('\n').filter(p => p.trim());
    }
    
    // 处理嵌套属性
    if (property.includes('.')) {
        const [parent, child] = property.split('.');
        if (!extension_settings.idle[parent]) {
            extension_settings.idle[parent] = {};
        }
        extension_settings.idle[parent][child] = value;
    } else {
        extension_settings.idle[property] = value;
    }
    
    saveSettingsDebounced();
}
function attachUpdateListener(elementId, property, isCheckbox = false) {
    $(`#${elementId}`).on('input', debounce(async () => {
        updateSetting(elementId, property, isCheckbox);
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    }, 250));
}
async function handleIdleEnabled() {
    if (!extension_settings.idle.enabled) {
        $('#idle_next_time').text('--');
        toastr.warning('Idle Extension: Disabled');
    } else {
        if (!extension_settings.idle.lastAIReplyTime) {
            extension_settings.idle.lastAIReplyTime = new Date().toISOString();
            saveSettingsDebounced();
        }
        toastr.success('Idle Extension: Enabled');
    }
    
    if (idleBackendClient && idleBackendClient.isConnected) {
        await idleBackendClient.syncAllData();
    }
}
function setupListeners() {
    const settingsToWatch = [
        ['idle_timer', 'timer'],
        ['idle_prompts', 'prompts'],
        ['idle_head_prompts', 'headPrompts'],
        ['idle_end_prompts', 'endPrompts'],
        ['idle_enabled', 'enabled', true],
        ['idle_random_time', 'randomTime', true],
        ['idle_timer_min', 'timerMin'],
        ['idle_include_prompt', 'includePrompt', true],
        ['idle_sendAs', 'sendAs'],
        ['idle_use_timer', 'useIdleTimer', true],
        ['idle_char_name', 'characterInfo.charName'],
        ['idle_char_description', 'characterInfo.charDescription'],
        ['idle_user_name', 'characterInfo.userName'],
        ['idle_user_description', 'characterInfo.userDescription'],
        ['idle_chat_path', 'characterInfo.chatFilePath'],
        ['idle_api_url', 'apiConfig.url'],
        ['idle_api_key', 'apiConfig.key'],
        ['idle_api_model', 'apiConfig.model'],
    ];
    settingsToWatch.forEach(setting => {
        attachUpdateListener(...setting);
    });
    $('#idle_enabled').on('input', debounce(handleIdleEnabled, 250));
    
    // 聊天记录滑块
    $('#idle_chat_count').on('input', function() {
        const value = $(this).val();
        $('#idle_chat_count_value').text(value);
        extension_settings.idle.chatCount = parseInt(value);
        saveSettingsDebounced();
        if (idleBackendClient && idleBackendClient.isConnected) {
            idleBackendClient.syncAllData();
        }
    });
    
    // 🔥 世界书列表添加按钮
    $('#idle_add_worldbook').on('click', () => {
        const val = $('#idle_new_worldbook').val().trim();
        if (!val) return;
        
        if (!extension_settings.idle.worldbookList) {
            extension_settings.idle.worldbookList = [];
        }
        
        extension_settings.idle.worldbookList.push({ name: val, enabled: true });
        saveSettingsDebounced();
        $('#idle_new_worldbook').val('');
        renderWorldbookList();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            idleBackendClient.syncAllData();
        }
    });
    
    // 正则列表添加按钮
    $('#idle_add_regex').on('click', () => {
        const val = $('#idle_new_regex').val().trim();
        if (!val) return;
        
        if (!extension_settings.idle.regexList) {
            extension_settings.idle.regexList = [];
        }
        
        extension_settings.idle.regexList.push({ pattern: val, enabled: true });
        saveSettingsDebounced();
        $('#idle_new_regex').val('');
        renderRegexList();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            idleBackendClient.syncAllData();
        }
    });
    
    $('#idle_reconnect_backend').on('click', () => {
        if (idleBackendClient) {
            idleBackendClient.connect();
        }
    });
    
    $('#idle_test_notification').on('click', async () => {
        if (idleBackendClient) {
            await idleBackendClient.testNotification();
        }
    });
    
    $('#idle_manual_trigger').on('click', async () => {
        if (idleBackendClient) {
            await idleBackendClient.manualTrigger();
        }
    });
    
    $('#idle_sync_now').on('click', async () => {
        if (idleBackendClient && idleBackendClient.isConnected) {
            toastr.info('正在同步配置...', 'Idle Extension');
            await idleBackendClient.syncAllData();
            toastr.success('配置同步完成', 'Idle Extension');
        } else {
            toastr.error('后端未连接', 'Idle Extension');
        }
    });
}
function toggleIdle() {
    extension_settings.idle.enabled = !extension_settings.idle.enabled;
    $('#idle_enabled').prop('checked', extension_settings.idle.enabled);
    $('#idle_enabled').trigger('input');
    toastr.info(`Idle mode ${extension_settings.idle.enabled ? 'enabled' : 'disabled'}.`);
}
function renderSchedules() {
    const onceList = $('#idle_schedule_once_list').empty();
    extension_settings.idle.scheduleOnceList.forEach((item, index) => {
        onceList.append(`
            <div class="schedule-entry" data-index="${index}">
                <input type="checkbox" class="once-enabled" ${item.enabled ? 'checked' : ''}>
                <input type="datetime-local" class="once-time" value="${item.time || ''}">
                <input type="text" class="once-prompt" value="${item.prompt || ''}" placeholder="Prompt">
                <button type="button" class="once-delete">✕</button>
            </div>
        `);
    });
    const dailyList = $('#idle_schedule_daily_list').empty();
    extension_settings.idle.scheduleDailyList.forEach((item, index) => {
        dailyList.append(`
            <div class="schedule-entry" data-index="${index}">
                <input type="checkbox" class="daily-enabled" ${item.enabled ? 'checked' : ''}>
                <input type="time" class="daily-time" value="${item.time || ''}">
                <input type="text" class="daily-prompt" value="${item.prompt || ''}" placeholder="Prompt">
                <button type="button" class="daily-delete">✕</button>
            </div>
        `);
    });
}
async function setupScheduleListeners() {
    $('#idle_add_schedule_once').on('click', async () => {
        extension_settings.idle.scheduleOnceList.push({ enabled: true, time: '', prompt: '' });
        saveSettingsDebounced();
        renderSchedules();
        toastr.success('Idle Extension: Added one-time schedule');
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    $('#idle_add_schedule_daily').on('click', async () => {
        extension_settings.idle.scheduleDailyList.push({ enabled: true, time: '', prompt: '' });
        saveSettingsDebounced();
        renderSchedules();
        toastr.success('Idle Extension: Added daily schedule');
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    $('#idle_schedule_once_list').on('input change click', '.schedule-entry', async function(e) {
        const index = $(this).data('index');
        const entry = extension_settings.idle.scheduleOnceList[index];
        if (e.target.classList.contains('once-enabled')) entry.enabled = e.target.checked;
        if (e.target.classList.contains('once-time')) entry.time = e.target.value;
        if (e.target.classList.contains('once-prompt')) entry.prompt = e.target.value;
        if (e.target.classList.contains('once-delete')) {
            extension_settings.idle.scheduleOnceList.splice(index, 1);
            renderSchedules();
            toastr.warning('Idle Extension: Removed one-time schedule');
        }
        saveSettingsDebounced();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    $('#idle_schedule_daily_list').on('input change click', '.schedule-entry', async function(e) {
        const index = $(this).data('index');
        const entry = extension_settings.idle.scheduleDailyList[index];
        if (e.target.classList.contains('daily-enabled')) entry.enabled = e.target.checked;
        if (e.target.classList.contains('daily-time')) entry.time = e.target.value;
        if (e.target.classList.contains('daily-prompt')) entry.prompt = e.target.value;
        if (e.target.classList.contains('daily-delete')) {
            extension_settings.idle.scheduleDailyList.splice(index, 1);
            renderSchedules();
            toastr.warning('Idle Extension: Removed daily schedule');
        }
        saveSettingsDebounced();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
}
// ========================================
// === 初始化 ===
// ========================================
jQuery(async () => {
    console.log('[Idle Extension] Initializing (Active Reply Mode)...');
    
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    setupScheduleListeners();
    renderSchedules();
    setupAIReplyMonitor();
    
    idleBackendClient = new IdleBackendClient();
    idleBackendClient.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (idleBackendClient.isConnected) {
        await idleBackendClient.syncAllData();
        console.log('[Idle Extension] Initial sync completed');
    } else {
        toastr.error('后端未连接！请运行后端服务', 'Idle Extension', {timeOut: 10000});
    }
    
    registerSlashCommand('idle', toggleIdle, [], '– toggles idle mode', true, true);
    
    console.log('[Idle Extension] Initialized (Active Reply Mode)');
});