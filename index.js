
import {
    saveSettingsDebounced,
    substituteParams,
} from '../../../../script.js';
import { debounce } from '../../../utils.js';
import { promptQuietForLoudResponse, sendNarratorMessage } from '../../../slash-commands.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { registerSlashCommand } from '../../../slash-commands.js';

const extensionName = 'third-party/Extension-Idle';

// 🔥 新的默认设置结构
let defaultSettings = {
    // 全局配置
    apiConfig: {
        url: '',
        key: '',
        model: ''
    },
    chatCount: 10,
    regexList: [],
    headPrompts: [],
    endPrompts: [],
    
    // 聊天列表（多聊天绑定）
    chatList: [],
    
    // 当前选中的聊天ID
    currentChatId: null,
    
    // 标记是否已迁移
    migrated: false
};

// 单个聊天的默认配置
const defaultChatConfig = {
    chatId: '',
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
    
    worldbookList: [],
    nextEventTime: null
};

// 🔥 修改后的 HTML
const settingsHTML = `
<div id="idle_container" class="extension-container">
    <details>
        <summary><b>Idle Settings (主动回复模式 - 多聊天版)</b></summary>
        
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
                <button type="button" id="idle_migrate_data" style="margin-left: 5px; padding: 5px 10px; background: #ff9800; color: white;">
                    🔄 转换数据格式
                </button>
            </div>
        </fieldset>
        
        <!-- 全局API配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>🌐 全局API配置</legend>
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
        
        <!-- 全局额外提示词配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>📝 全局额外提示词</legend>
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
        
        <!-- 全局聊天记录配置 -->
        <fieldset style="margin-bottom: 10px;">
            <legend>💬 全局聊天记录配置</legend>
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
        
        <!-- 🔥 聊天列表管理 -->
        <fieldset style="margin-bottom: 10px; border: 2px solid #e67e22;">
            <legend style="font-weight: bold; color: #e67e22;">📋 聊天列表管理</legend>
            <div>
                <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                    <input type="text" id="idle_new_chat_path" placeholder="chats/角色名/聊天文件.jsonl" style="flex: 1;">
                    <button type="button" id="idle_add_chat" style="background: #e67e22; color: white;">添加聊天</button>
                </div>
                <div id="idle_chat_list" style="max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 6px; border-radius: 6px; margin-bottom: 10px;"></div>
                <div id="idle_current_chat_indicator" style="padding: 8px; background: #f0f0f0; border-radius: 6px; margin-bottom: 10px;">
                    当前编辑: <span style="font-weight: bold; color: #e67e22;">未选择</span>
                </div>
            </div>
        </fieldset>
        
        <!-- 🔥 当前聊天配置区域 -->
        <div id="idle_chat_config_area" style="display: none;">
            <fieldset style="margin-bottom: 10px; border: 2px solid #3498db;">
                <legend style="font-weight: bold; color: #3498db;">⚙️ 当前聊天配置</legend>
                
                <!-- 角色信息 -->
                <fieldset style="margin-bottom: 10px;">
                    <legend>角色信息</legend>
                    <div style="display: grid; gap: 8px;">
                        <label>
                            角色名 ({{char}}):
                            <input type="text" id="idle_char_name" placeholder="输入角色名">
                        </label>
                        <label>
                            角色描述:
                            <textarea id="idle_char_description" rows="3" placeholder="角色的详细描述"></textarea>
                        </label>
                        <label>
                            用户名 ({{user}}):
                            <input type="text" id="idle_user_name" placeholder="输入用户名">
                        </label>
                        <label>
                            用户描述:
                            <textarea id="idle_user_description" rows="3" placeholder="用户的详细描述"></textarea>
                        </label>
                    </div>
                </fieldset>
                
                <!-- 世界书配置 -->
                <fieldset style="margin-bottom: 10px;">
                    <legend>世界书配置</legend>
                    <div>
                        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                            <input type="text" id="idle_new_worldbook" placeholder="世界书文件名" style="flex: 1;">
                            <button type="button" id="idle_add_worldbook">添加</button>
                        </div>
                        <div id="idle_worldbook_list" style="max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 6px; border-radius: 6px;"></div>
                    </div>
                </fieldset>
                
                <!-- Idle行为配置 -->
                <fieldset>
                    <legend>Idle 行为配置</legend>
                    <div>
                        <label>
                            <input type="checkbox" id="idle_use_timer">
                            启用自动回复
                        </label>
                    </div>
                    <div>
                        <label>
                            <input type="checkbox" id="idle_random_time">
                            使用随机时间
                        </label>
                    </div>
                    <div>
                        <label for="idle_timer">回复间隔 (秒):</label>
                        <input type="number" id="idle_timer" min="1">
                    </div>
                    <div>
                        <label for="idle_timer_min">最小间隔 (随机时):</label>
                        <input type="number" id="idle_timer_min" min="1">
                    </div>
                    <div>
                        <label for="idle_prompts">Idle提示词 (每行一个):</label>
                        <textarea id="idle_prompts" rows="5"></textarea>
                    </div>
                    <div>
                        <label for="idle_sendAs">发送身份:</label>
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
                            在消息中包含提示
                        </label>
                    </div>
                    <div class="idle-next-time">
                        下次触发: <span id="idle_next_time">--</span>
                    </div>
                    
                    <!-- 定时任务 -->
                    <fieldset>
                        <legend>一次性定时</legend>
                        <div id="idle_schedule_once_list"></div>
                        <button type="button" id="idle_add_schedule_once">+ 添加一次性定时</button>
                    </fieldset>
                    
                    <fieldset>
                        <legend>每日定时</legend>
                        <div id="idle_schedule_daily_list"></div>
                        <button type="button" id="idle_add_schedule_daily">+ 添加每日定时</button>
                    </fieldset>
                </fieldset>
            </fieldset>
        </div>
    </details>
</div>
`;

// ========================================
// === 聊天列表管理函数 ===
// ========================================

function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getCurrentChat() {
    const chatId = extension_settings.idle.currentChatId;
    if (!chatId) return null;
    return extension_settings.idle.chatList.find(c => c.chatId === chatId);
}

function renderChatList() {
    const container = $('#idle_chat_list');
    container.empty();
    
    const chatList = extension_settings.idle.chatList || [];
    
    if (chatList.length === 0) {
        container.append('<div style="color: #999; padding: 10px; text-align: center;">暂无聊天配置</div>');
        return;
    }
    
    chatList.forEach((chat) => {
        const div = $('<div>').css({
            display: 'flex',
            alignItems: 'center',
            marginBottom: '6px',
            gap: '6px',
            padding: '6px',
            background: chat.chatId === extension_settings.idle.currentChatId ? '#e3f2fd' : 'transparent',
            borderRadius: '4px',
            border: '1px solid ' + (chat.enabled ? '#4caf50' : '#ccc')
        });
        
        const checkbox = $('<input>')
            .attr('type', 'checkbox')
            .prop('checked', chat.enabled)
            .on('change', function() {
                chat.enabled = this.checked;
                saveSettingsDebounced();
                renderChatList();
                if (idleBackendClient && idleBackendClient.isConnected) {
                    idleBackendClient.syncAllData();
                }
            });
        
        const text = $('<span>')
            .text(chat.characterInfo.chatFilePath || '未命名')
            .css({ flex: '1', wordBreak: 'break-all', cursor: 'pointer' })
            .on('click', () => {
                selectChat(chat.chatId);
            });
        
        const editBtn = $('<button>')
            .text('编辑')
            .on('click', () => {
                selectChat(chat.chatId);
            });
        
        const delBtn = $('<button>')
            .text('删除')
            .css({ background: '#f44336', color: 'white' })
            .on('click', () => {
                if (confirm(`确定删除聊天 "${chat.characterInfo.chatFilePath}" 吗？`)) {
                    const idx = extension_settings.idle.chatList.findIndex(c => c.chatId === chat.chatId);
                    extension_settings.idle.chatList.splice(idx, 1);
                    if (extension_settings.idle.currentChatId === chat.chatId) {
                        extension_settings.idle.currentChatId = null;
                        $('#idle_chat_config_area').hide();
                    }
                    saveSettingsDebounced();
                    renderChatList();
                    updateCurrentChatIndicator();
                    if (idleBackendClient && idleBackendClient.isConnected) {
                        idleBackendClient.syncAllData();
                    }
                }
            });
        
        div.append(checkbox, text, editBtn, delBtn);
        container.append(div);
    });
}

function selectChat(chatId) {
    extension_settings.idle.currentChatId = chatId;
    saveSettingsDebounced();
    
    renderChatList();
    updateCurrentChatIndicator();
    populateChatConfigUI();
    
    $('#idle_chat_config_area').show();
}

function updateCurrentChatIndicator() {
    const chat = getCurrentChat();
    const indicator = $('#idle_current_chat_indicator span');
    
    if (chat) {
        indicator.text(chat.characterInfo.chatFilePath || '未命名');
    } else {
        indicator.text('未选择');
    }
}

function populateChatConfigUI() {
    const chat = getCurrentChat();
    if (!chat) return;
    
    console.log('[Idle Extension] Populating chat config UI:', chat);
    
    // 🔥 修复：确保 characterInfo 存在
    if (!chat.characterInfo) {
        chat.characterInfo = { ...defaultChatConfig.characterInfo };
    }
    
    // 角色信息 - 使用空字符串作为默认值
    $('#idle_char_name').val(chat.characterInfo.charName || '');
    $('#idle_char_description').val(chat.characterInfo.charDescription || '');
    $('#idle_user_name').val(chat.characterInfo.userName || '');
    $('#idle_user_description').val(chat.characterInfo.userDescription || '');
    
    // Idle配置
    $('#idle_timer').val(chat.timer || 120);
    $('#idle_prompts').val(Array.isArray(chat.prompts) ? chat.prompts.join('\n') : '');
    $('#idle_random_time').prop('checked', chat.randomTime || false);
    $('#idle_timer_min').val(chat.timerMin || 60);
    $('#idle_include_prompt').prop('checked', chat.includePrompt || false);
    $('#idle_sendAs').val(chat.sendAs || 'user');
    $('#idle_use_timer').prop('checked', chat.useIdleTimer !== false);
    
    // 渲染世界书和定时任务
    renderWorldbookList();
    renderSchedules();
}

// ========================================
// === 世界书列表管理 ===
// ========================================

function renderWorldbookList() {
    const container = $('#idle_worldbook_list');
    container.empty();
    
    const chat = getCurrentChat();
    if (!chat) {
        container.append('<div style="color: #999; padding: 10px; text-align: center;">请先选择聊天</div>');
        return;
    }
    
    const worldbookList = chat.worldbookList || [];
    
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
                chat.worldbookList = worldbookList;
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
                    chat.worldbookList = worldbookList;
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
                chat.worldbookList = worldbookList;
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

// ========================================
// === 正则列表管理 ===
// ========================================

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
// === 🔥 数据迁移函数 ===
// ========================================

function migrateOldData() {
    console.log('[Idle Extension] Starting data migration...');
    
    // 检查是否已经迁移过
    if (extension_settings.idle.migrated === true) {
        console.log('[Idle Extension] Data already migrated, skipping');
        toastr.info('数据已经是新格式，无需转换', 'Idle Extension');
        return;
    }
    
    // 检查是否有旧数据需要迁移
    const hasOldData = extension_settings.idle.characterInfo && 
                      extension_settings.idle.characterInfo.chatFilePath;
    
    if (!hasOldData) {
        console.log('[Idle Extension] No old data to migrate');
        extension_settings.idle.migrated = true;
        saveSettingsDebounced();
        return;
    }
    
    console.log('[Idle Extension] Migrating old single chat config to new format');
    
    const oldChatConfig = {
        chatId: generateChatId(),
        enabled: extension_settings.idle.enabled || false,
        timer: extension_settings.idle.timer || 120,
        prompts: Array.isArray(extension_settings.idle.prompts) ? 
                 extension_settings.idle.prompts : [...defaultChatConfig.prompts],
        randomTime: extension_settings.idle.randomTime || false,
        timerMin: extension_settings.idle.timerMin || 60,
        includePrompt: extension_settings.idle.includePrompt || false,
        scheduleOnceList: Array.isArray(extension_settings.idle.scheduleOnceList) ? 
                         extension_settings.idle.scheduleOnceList : [],
        scheduleDailyList: Array.isArray(extension_settings.idle.scheduleDailyList) ? 
                          extension_settings.idle.scheduleDailyList : [],
        useIdleTimer: extension_settings.idle.useIdleTimer !== false,
        sendAs: extension_settings.idle.sendAs || 'user',
        lastAIReplyTime: extension_settings.idle.lastAIReplyTime || null,
        characterInfo: {
            charName: extension_settings.idle.characterInfo.charName || '',
            userName: extension_settings.idle.characterInfo.userName || '',
            chatFilePath: extension_settings.idle.characterInfo.chatFilePath || '',
            charDescription: extension_settings.idle.characterInfo.charDescription || '',
            userDescription: extension_settings.idle.characterInfo.userDescription || ''
        },
        worldbookList: Array.isArray(extension_settings.idle.worldbookList) ? 
                      extension_settings.idle.worldbookList : []
    };
    
    // 添加到聊天列表
    if (!Array.isArray(extension_settings.idle.chatList)) {
        extension_settings.idle.chatList = [];
    }
    extension_settings.idle.chatList.push(oldChatConfig);
    
    // 标记为已迁移
    extension_settings.idle.migrated = true;
    
    // 清理旧数据字段
    delete extension_settings.idle.enabled;
    delete extension_settings.idle.timer;
    delete extension_settings.idle.prompts;
    delete extension_settings.idle.randomTime;
    delete extension_settings.idle.timerMin;
    delete extension_settings.idle.includePrompt;
    delete extension_settings.idle.scheduleOnceList;
    delete extension_settings.idle.scheduleDailyList;
    delete extension_settings.idle.useIdleTimer;
    delete extension_settings.idle.sendAs;
    delete extension_settings.idle.lastAIReplyTime;
    delete extension_settings.idle.characterInfo;
    delete extension_settings.idle.worldbookList;
    
    saveSettingsDebounced();
    
    console.log('[Idle Extension] Migration completed:', oldChatConfig);
    toastr.success('旧数据已成功转换为新格式！', 'Idle Extension');
    
    // 刷新UI
    renderChatList();
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
            toastr.success('后端服务已连接 - 多聊天模式', 'Idle Extension');
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
            break;
            
        case 'NEXT_TIME_UPDATE':
            // 🔥 全新的下次触发显示逻辑
            this.updateNextTriggerDisplay(message.data);
            break;
            
        case 'IDLE_TRIGGER':
        case 'SCHEDULE_ONCE_TRIGGER':
        case 'SCHEDULE_DAILY_TRIGGER':
            console.log('[Idle Backend] ⏰ 后端主动回复完成!');
            toastr.success('后端已自动回复', 'Idle Extension');
            $('#idle_next_time').text('等待下次触发...');
            setTimeout(() => location.reload(), 5000);
            break;
    }
}

// 🔥 新增方法：更新下次触发时间显示
updateNextTriggerDisplay(data) {
    // 验证数据
    if (!data || !data.chatId || !data.nextTriggerTime) {
        return;
    }
    
    // 检查是否是当前正在查看的聊天
    const currentChat = getCurrentChat();
    if (!currentChat || currentChat.chatId !== data.chatId) {
        return;
    }
    
    try {
        // 解析时间（UTC 自动转换为本地时间）
        const triggerTime = new Date(data.nextTriggerTime);
        const now = new Date();
        
        // 验证时间有效性
        if (isNaN(triggerTime.getTime())) {
            $('#idle_next_time').text('时间格式错误');
            return;
        }
        
        // 计算剩余秒数
        const remainingSeconds = Math.max(0, Math.ceil((triggerTime - now) / 1000));
        
        // 格式化显示时间
        const displayTime = this.formatTriggerTime(triggerTime);
        
        // 更新UI
        $('#idle_next_time').html(
            `<span style="color: #2196F3; font-weight: bold;">${displayTime}</span> ` +
            `<span style="color: #666;">(${remainingSeconds}秒后)</span>`
        );
        
    } catch (error) {
        console.error('[Idle] 更新下次触发时间失败:', error);
        $('#idle_next_time').text('解析失败');
    }
}

// 🔥 新增方法：格式化触发时间
formatTriggerTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // 计算天数差
    const dayDiff = Math.floor((targetDay - today) / (1000 * 60 * 60 * 24));
    
    // 格式化时间 HH:MM
    const timeStr = date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    // 根据日期差返回不同格式
    if (dayDiff === 0) {
        return `今天 ${timeStr}`;
    } else if (dayDiff === 1) {
        return `明天 ${timeStr}`;
    } else if (dayDiff === -1) {
        return `昨天 ${timeStr}`;
    } else {
        const dateStr = date.toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit'
        });
        return `${dateStr} ${timeStr}`;
    }
}
  
    async collectSyncData() {
        // 全局配置
        const apiConfig = {
            url: $('#idle_api_url').val() || '',
            key: $('#idle_api_key').val() || '',
            model: $('#idle_api_model').val() || ''
        };
        
        const headPrompts = $('#idle_head_prompts').val().split('\n').filter(p => p.trim());
        const endPrompts = $('#idle_end_prompts').val().split('\n').filter(p => p.trim());
        const regexList = extension_settings.idle.regexList || [];
        const chatCount = parseInt($('#idle_chat_count').val()) || 10;
        
        // 获取预设
        const presetData = await this.getPresetData();
        
        // 🔥 收集所有启用的聊天配置
        const enabledChats = extension_settings.idle.chatList
            .filter(chat => chat.enabled)
            .map(chat => ({
                chatId: chat.chatId,
                ...chat,
                worldbookNames: (chat.worldbookList || [])
                    .filter(wb => wb.enabled)
                    .map(wb => wb.name)
            }));
        
        return {
            apiConfig,
            chatCount,
            regexList,
            headPrompts,
            endPrompts,
            presetData,
            chatList: enabledChats
        };
    }
    
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
    
   
    
    async testNotification() {
        if (!this.isConnected) {
            toastr.error('后端未连接', 'Idle Extension');
            return;
        }
        toastr.success('测试通知已发送', 'Idle Extension');
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

let idleBackendClient = null;

// ========================================
// === AI 回复监听器 ===
// ========================================



// ========================================
// === 设置加载和UI ===
// ========================================

async function loadSettings() {
    if (!extension_settings.idle) {
        extension_settings.idle = {};
    }
    
    console.log('[Idle Extension] Loading settings...');
    
    // 合并默认全局设置
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.idle.hasOwnProperty(key)) {
            extension_settings.idle[key] = Array.isArray(value) ? [...value] : 
                                          (typeof value === 'object' && value !== null ? {...value} : value);
        }
    }
    
    // 确保 chatList 存在
    if (!Array.isArray(extension_settings.idle.chatList)) {
        extension_settings.idle.chatList = [];
    }
    
    // 🔥 自动迁移旧数据（仅在未迁移时执行）
    if (extension_settings.idle.migrated !== true) {
        migrateOldData();
    }
    
    populateUIWithSettings();
}

function populateUIWithSettings() {
    console.log('[Idle Extension] Populating UI with settings...');
    
    // 全局配置
    const apiConfig = extension_settings.idle.apiConfig || {};
    $('#idle_api_url').val(apiConfig.url || '');
    $('#idle_api_key').val(apiConfig.key || '');
    $('#idle_api_model').val(apiConfig.model || '');
    
    const headPrompts = extension_settings.idle.headPrompts || [];
    const endPrompts = extension_settings.idle.endPrompts || [];
    $('#idle_head_prompts').val(headPrompts.join('\n'));
    $('#idle_end_prompts').val(endPrompts.join('\n'));
    
    const chatCount = extension_settings.idle.chatCount || 10;
    $('#idle_chat_count').val(chatCount);
    $('#idle_chat_count_value').text(chatCount);
    
    renderRegexList();
    renderChatList();
    updateCurrentChatIndicator();
    
    // 如果有选中的聊天，显示配置区域
    if (extension_settings.idle.currentChatId) {
        $('#idle_chat_config_area').show();
        populateChatConfigUI();
    }
    
    console.log('[Idle Extension] Settings populated from storage');
}

async function loadSettingsHTML() {
    const getContainer = () => $(document.getElementById('idle_container') ?? document.getElementById('extensions_settings2'));
    getContainer().append(settingsHTML);
}

function updateChatSetting(property, value) {
    const chat = getCurrentChat();
    if (!chat) return;
    
    console.log('[Idle Extension] Updating chat setting:', property, '=', value);
    
    // 🔥 修复：确保 characterInfo 存在
    if (property.startsWith('characterInfo.') && !chat.characterInfo) {
        chat.characterInfo = { ...defaultChatConfig.characterInfo };
    }
    
    // 处理嵌套属性
    if (property.includes('.')) {
        const parts = property.split('.');
        let obj = chat;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) {
                obj[parts[i]] = {};
            }
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    } else {
        chat[property] = value;
    }
    
    saveSettingsDebounced();
}

function setupListeners() {
    // 🔥 全局配置监听
    const globalSettings = [
        ['idle_api_url', (val) => { extension_settings.idle.apiConfig.url = val; }],
        ['idle_api_key', (val) => { extension_settings.idle.apiConfig.key = val; }],
        ['idle_api_model', (val) => { extension_settings.idle.apiConfig.model = val; }],
        ['idle_head_prompts', (val) => { extension_settings.idle.headPrompts = val.split('\n').filter(p => p.trim()); }],
        ['idle_end_prompts', (val) => { extension_settings.idle.endPrompts = val.split('\n').filter(p => p.trim()); }],
    ];
    
    globalSettings.forEach(([elementId, handler]) => {
        $(`#${elementId}`).on('input', debounce(async () => {
            const value = $(`#${elementId}`).val();
            handler(value);
            saveSettingsDebounced();
            if (idleBackendClient && idleBackendClient.isConnected) {
                await idleBackendClient.syncAllData();
            }
        }, 250));
    });
    
    // 🔥 当前聊天配置监听 - 修复值获取方式
    const chatSettings = [
        ['idle_timer', 'timer', 'val', (val) => parseInt(val) || 120],
        ['idle_prompts', 'prompts', 'val', (val) => val.split('\n').filter(p => p.trim())],
        ['idle_random_time', 'randomTime', 'checked'],
        ['idle_timer_min', 'timerMin', 'val', (val) => parseInt(val) || 60],
        ['idle_include_prompt', 'includePrompt', 'checked'],
        ['idle_sendAs', 'sendAs', 'val'],
        ['idle_use_timer', 'useIdleTimer', 'checked'],
        ['idle_char_name', 'characterInfo.charName', 'val'],
        ['idle_char_description', 'characterInfo.charDescription', 'val'],
        ['idle_user_name', 'characterInfo.userName', 'val'],
        ['idle_user_description', 'characterInfo.userDescription', 'val'],
    ];
    
    chatSettings.forEach(([elementId, property, valueType, transform]) => {
        $(`#${elementId}`).on('input change', debounce(async () => {
            let value;
            if (valueType === 'checked') {
                value = $(`#${elementId}`).prop('checked');
            } else {
                value = $(`#${elementId}`).val();
            }
            
            if (transform) {
                value = transform(value);
            }
            
            updateChatSetting(property, value);
            
            if (idleBackendClient && idleBackendClient.isConnected) {
                await idleBackendClient.syncAllData();
            }
        }, 250));
    });
    
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
    
    // 🔥 添加聊天
    $('#idle_add_chat').on('click', () => {
        const chatPath = $('#idle_new_chat_path').val().trim();
        if (!chatPath) {
            toastr.warning('请输入聊天文件路径', 'Idle Extension');
            return;
        }
        
        // 深拷贝默认配置
        const newChat = JSON.parse(JSON.stringify(defaultChatConfig));
        newChat.chatId = generateChatId();
        newChat.characterInfo.chatFilePath = chatPath;
        
        extension_settings.idle.chatList.push(newChat);
        saveSettingsDebounced();
        $('#idle_new_chat_path').val('');
        renderChatList();
        toastr.success('聊天已添加', 'Idle Extension');
        
        // 自动选中新添加的聊天
        selectChat(newChat.chatId);
    });
    
    // 正则列表添加
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
    
    // 世界书添加
    $('#idle_add_worldbook').on('click', () => {
        const val = $('#idle_new_worldbook').val().trim();
        if (!val) return;
        
        const chat = getCurrentChat();
        if (!chat) {
            toastr.warning('请先选择聊天', 'Idle Extension');
            return;
        }
        
        if (!chat.worldbookList) {
            chat.worldbookList = [];
        }
        
        chat.worldbookList.push({ name: val, enabled: true });
        saveSettingsDebounced();
        $('#idle_new_worldbook').val('');
        renderWorldbookList();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            idleBackendClient.syncAllData();
        }
    });
    
    // 🔥 数据迁移按钮
    $('#idle_migrate_data').on('click', () => {
        if (confirm('确定要转换数据格式吗？\n\n这将把旧格式的单聊天配置转换为新格式的多聊天配置。\n转换后旧数据将被清理。')) {
            // 强制重新迁移
            extension_settings.idle.migrated = false;
            migrateOldData();
            renderChatList();
            updateCurrentChatIndicator();
        }
    });
    
    // 后端控制按钮
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

// ========================================
// === 定时任务管理 ===
// ========================================

function renderSchedules() {
    const chat = getCurrentChat();
    if (!chat) return;
    
    const onceList = $('#idle_schedule_once_list').empty();
    (chat.scheduleOnceList || []).forEach((item, index) => {
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
    (chat.scheduleDailyList || []).forEach((item, index) => {
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
        const chat = getCurrentChat();
        if (!chat) {
            toastr.warning('请先选择聊天', 'Idle Extension');
            return;
        }
        
        if (!chat.scheduleOnceList) chat.scheduleOnceList = [];
        chat.scheduleOnceList.push({ enabled: true, time: '', prompt: '' });
        saveSettingsDebounced();
        renderSchedules();
        toastr.success('添加一次性定时', 'Idle Extension');
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    
    $('#idle_add_schedule_daily').on('click', async () => {
        const chat = getCurrentChat();
        if (!chat) {
            toastr.warning('请先选择聊天', 'Idle Extension');
            return;
        }
        
        if (!chat.scheduleDailyList) chat.scheduleDailyList = [];
        chat.scheduleDailyList.push({ enabled: true, time: '', prompt: '' });
        saveSettingsDebounced();
        renderSchedules();
        toastr.success('添加每日定时', 'Idle Extension');
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    
    $('#idle_schedule_once_list').on('input change click', '.schedule-entry', async function(e) {
        const chat = getCurrentChat();
        if (!chat) return;
        
        const index = $(this).data('index');
        const entry = chat.scheduleOnceList[index];
        
        if (e.target.classList.contains('once-enabled')) entry.enabled = e.target.checked;
        if (e.target.classList.contains('once-time')) entry.time = e.target.value;
        if (e.target.classList.contains('once-prompt')) entry.prompt = e.target.value;
        if (e.target.classList.contains('once-delete')) {
            chat.scheduleOnceList.splice(index, 1);
            renderSchedules();
            toastr.warning('已删除一次性定时', 'Idle Extension');
        }
        
        saveSettingsDebounced();
        
        if (idleBackendClient && idleBackendClient.isConnected) {
            await idleBackendClient.syncAllData();
        }
    });
    
    $('#idle_schedule_daily_list').on('input change click', '.schedule-entry', async function(e) {
        const chat = getCurrentChat();
        if (!chat) return;
        
        const index = $(this).data('index');
        const entry = chat.scheduleDailyList[index];
        
        if (e.target.classList.contains('daily-enabled')) entry.enabled = e.target.checked;
        if (e.target.classList.contains('daily-time')) entry.time = e.target.value;
        if (e.target.classList.contains('daily-prompt')) entry.prompt = e.target.value;
        if (e.target.classList.contains('daily-delete')) {
            chat.scheduleDailyList.splice(index, 1);
            renderSchedules();
            toastr.warning('已删除每日定时', 'Idle Extension');
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
    console.log('[Idle Extension] Initializing (Multi-Chat Active Reply Mode)...');
    
    await loadSettingsHTML();
    loadSettings();
    setupListeners();
    setupScheduleListeners();
    
    
    idleBackendClient = new IdleBackendClient();
    idleBackendClient.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (idleBackendClient.isConnected) {
        await idleBackendClient.syncAllData();
        console.log('[Idle Extension] Initial sync completed');
    } else {
        toastr.error('后端未连接！请运行后端服务', 'Idle Extension', {timeOut: 10000});
    }
    
    registerSlashCommand('idle', () => {
        const chat = getCurrentChat();
        if (chat) {
            chat.enabled = !chat.enabled;
            saveSettingsDebounced();
            renderChatList();
            toastr.info(`当前聊天 Idle 模式 ${chat.enabled ? '已启用' : '已禁用'}`, 'Idle Extension');
        } else {
            toastr.warning('请先选择聊天', 'Idle Extension');
        }
    }, [], '– 切换当前聊天的 idle 模式', true, true);
    
    console.log('[Idle Extension] Initialized (Multi-Chat Active Reply Mode)');
});
