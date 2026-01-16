// phone-bridge.js - 小手机桥接脚本
// 运行于酒馆助手 (TavernHelper)
// 用于将酒馆的消息事件同步到独立的小手机应用

// ============ 配置 ============

const CONFIG = {
  serverUrl: 'http://localhost:3001',
  apiKey: '',  // API Key（留空则从服务器获取或禁用鉴权）
  floorRange: 10,
  debug: true,
  autoConnect: false,
  reconnectInterval: 5000,
  autoSync: true,
  syncInterval: 5000,
};

// 脚本标识
const SCRIPT_ID = 'phone-bridge';
const PANEL_ID = `${SCRIPT_ID}-panel`;

// 变量路径常量
const SESSION_ID_PATH = '_phone_bridge.sessionId';
const CONFIG_PATH = '_phone_bridge.config';

// ============ 状态 ============

let socket = null;
let isConnected = false;
let isConnecting = false;  // 防止重复连接
let wasReplaced = false;   // 是否被替换（禁止自动重连）
let reconnectTimer = null;
let lastPingTime = null;
let lastPongTime = null;
let latency = null;
let autoSyncTimer = null;
let isGenerating = false;  // 是否正在请求 LLM 生成
let generationStartTime = null;  // 生成开始时间
let lastSyncTime = null;  // 上次同步时间
let syncCount = 0;  // 同步次数
let panelElement = null;  // 面板 DOM 元素

// ============ 工具函数 ============

function log(...args) {
  if (CONFIG.debug) {
    console.log('[PhoneBridge]', ...args);
    appendLog('info', args.join(' '));
  }
}

function warn(...args) {
  console.warn('[PhoneBridge]', ...args);
  appendLog('warn', args.join(' '));
}

function error(...args) {
  console.error('[PhoneBridge]', ...args);
  appendLog('error', args.join(' '));
}

function showToast(type, message, title = 'PhoneBridge') {
  if (typeof toastr !== 'undefined') {
    toastr[type](message, title);
  }
}

/**
 * 生成 UUID v4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============ 配置持久化 ============

function saveConfig() {
  try {
    if (typeof insertOrAssignVariables === 'function') {
      insertOrAssignVariables(
        { _phone_bridge: { config: { ...CONFIG } } },
        { type: 'script', script_id: getScriptId?.() || SCRIPT_ID }
      );
      log('配置已保存');
    }
  } catch (e) {
    error('保存配置失败:', e);
  }
}

function loadConfig() {
  try {
    if (typeof getVariables === 'function') {
      const vars = getVariables({ type: 'script', script_id: getScriptId?.() || SCRIPT_ID });
      const savedConfig = _.get(vars, CONFIG_PATH);
      if (savedConfig) {
        Object.assign(CONFIG, savedConfig);
        log('配置已加载:', CONFIG);
      }
    }
  } catch (e) {
    error('加载配置失败:', e);
  }
}

// ============ Socket.IO 加载 ============

async function loadSocketIO() {
  if (window.io) {
    log('Socket.IO 已存在');
    return window.io;
  }

  log('正在加载 Socket.IO...');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      log('Socket.IO 加载成功');
      resolve(window.io);
    };

    script.onerror = (err) => {
      error('Socket.IO 加载失败:', err);
      showToast('error', 'Socket.IO 库加载失败');
      reject(new Error('Failed to load Socket.IO'));
    };

    document.head.appendChild(script);
  });
}

// ============ Session ID 管理 ============

// 缓存 sessionId，避免频繁读取变量
let cachedSessionId = null;

function getOrCreateSessionId() {
  try {
    // 如果有缓存，直接返回
    if (cachedSessionId) {
      return cachedSessionId;
    }
    
    if (typeof getVariables !== 'function') {
      warn('getVariables 不可用，使用临时 ID');
      cachedSessionId = `temp-${Date.now()}`;
      return cachedSessionId;
    }

    const chatVars = getVariables({ type: 'chat' });
    const existingId = _.get(chatVars, SESSION_ID_PATH);
    
    // 调试：输出读取到的值
    if (CONFIG.debug) {
      log(`[sessionId] 读取变量: existingId="${existingId}", type=${typeof existingId}`);
    }
    
    // 检查是否为有效的非空字符串
    if (existingId && typeof existingId === 'string' && existingId.trim() !== '') {
      cachedSessionId = existingId;
      return cachedSessionId;
    }

    const newId = generateUUID();
    log('生成新的 sessionId:', newId);

    if (typeof insertOrAssignVariables === 'function') {
      insertOrAssignVariables(
        { _phone_bridge: { sessionId: newId } },
        { type: 'chat' }
      );
      log('[sessionId] 已保存到聊天变量');
    }

    cachedSessionId = newId;
    return cachedSessionId;
  } catch (e) {
    error('获取/创建 sessionId 失败:', e);
    cachedSessionId = `error-${Date.now()}`;
    return cachedSessionId;
  }
}

// 清除缓存（聊天切换时调用）
function clearSessionIdCache() {
  log('[sessionId] 清除缓存，旧值:', cachedSessionId);
  cachedSessionId = null;
}

function getSessionId() {
  try {
    if (typeof getVariables !== 'function') return null;
    const chatVars = getVariables({ type: 'chat' });
    return _.get(chatVars, SESSION_ID_PATH) || null;
  } catch (e) {
    return null;
  }
}

// ============ 数据收集 ============

function getCharacterName() {
  try {
    if (typeof SillyTavern !== 'undefined') {
      return SillyTavern.name2 || 'Character';
    }
    return 'Character';
  } catch (e) {
    return 'Character';
  }
}

function getPlayerName() {
  try {
    if (typeof SillyTavern !== 'undefined') {
      return SillyTavern.name1 || 'Player';
    }
    return 'Player';
  } catch (e) {
    return 'Player';
  }
}

function getLastMsgId() {
  try {
    if (typeof getLastMessageId === 'function') {
      return getLastMessageId();
    }
    if (typeof SillyTavern !== 'undefined' && SillyTavern.chat?.length) {
      return SillyTavern.chat.length - 1;
    }
    return -1;
  } catch (e) {
    warn('获取最后消息ID失败:', e);
    return -1;
  }
}

function getMessages(range, options = {}) {
  try {
    const sessionId = getOrCreateSessionId();
    
    if (typeof getChatMessages === 'function') {
      const messages = getChatMessages(range, options);
      
      // 调试：输出原始 API 返回
      if (CONFIG.debug) {
        log(`[getMessages] 调用 getChatMessages("${range}", ${JSON.stringify(options)})`);
        log(`[getMessages] 返回 ${messages.length} 条消息`);
        if (messages.length > 0) {
          log(`[getMessages] 第一条: id=${messages[0].message_id}, role=${messages[0].role}, name=${messages[0].name}`);
          log(`[getMessages] 最后一条: id=${messages[messages.length-1].message_id}, role=${messages[messages.length-1].role}, name=${messages[messages.length-1].name}`);
        }
      }
      
      return messages.map(msg => ({
        ...msg,
        sessionId: sessionId,
      }));
    }

    warn('getChatMessages 不可用');
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) return [];

    const chat = SillyTavern.chat;
    
    if (typeof range === 'number') {
      const idx = range < 0 ? chat.length + range : range;
      const msg = chat[idx];
      if (!msg) return [];
      return [{
        message_id: idx,
        sessionId: sessionId,
        name: msg.name || '',
        role: msg.is_user ? 'user' : (msg.is_system ? 'system' : 'assistant'),
        is_hidden: msg.is_hidden || false,
        message: msg.mes || '',
        data: msg.variables || {},
        extra: msg.extra || {},
      }];
    }

    if (typeof range === 'string' && range.includes('-')) {
      const [start, end] = range.split('-').map(Number);
      return chat.slice(start, end + 1).map((msg, i) => ({
        message_id: start + i,
        sessionId: sessionId,
        name: msg.name || '',
        role: msg.is_user ? 'user' : (msg.is_system ? 'system' : 'assistant'),
        is_hidden: msg.is_hidden || false,
        message: msg.mes || '',
        data: msg.variables || {},
        extra: msg.extra || {},
      }));
    }

    return [];
  } catch (e) {
    error('获取消息失败:', e);
    return [];
  }
}

function getPhoneData() {
  try {
    if (typeof getVariables === 'function') {
      const vars = getVariables({ type: 'chat' });
      return vars['小手机'] || vars['phone'] || {};
    }
    return {};
  } catch (e) {
    warn('获取小手机数据失败:', e);
    return {};
  }
}

// ============ 连接管理 ============

async function connect() {
  // 防止重复连接
  if (isConnected || socket?.connected) {
    log('已经连接');
    showToast('info', '已经连接到服务器');
    return;
  }
  
  if (isConnecting) {
    log('正在连接中，跳过');
    return;
  }
  
  isConnecting = true;
  wasReplaced = false;  // 重置替换标记

  try {
    const io = await loadSocketIO();
    const sessionId = getOrCreateSessionId();

    log(`正在连接到 ${CONFIG.serverUrl}...`);
    showToast('info', `正在连接...`);

    const socketOptions = {
      query: {
        type: 'platform',
        platform: 'sillytavern',
        chatId: sessionId,
      },
      // 只用 websocket（polling 在酒馆脚本中有 CORS 问题）
      transports: ['websocket'],
      upgrade: false,
      reconnection: false,
      // 增加超时时间
      timeout: 30000,
      // 强制新连接
      forceNew: true,
    };
    
    log(`[连接调试] 创建 socket，sessionId=${sessionId}, 只用 WebSocket`);
    
    if (CONFIG.apiKey) {
      socketOptions.auth = { apiKey: CONFIG.apiKey };
      log('使用 API Key 鉴权');
    }
    
    socket = io(CONFIG.serverUrl, socketOptions);

    socket.on('connect', () => {
      isConnected = true;
      isConnecting = false;
      const socketId = socket.id;
      log(`[连接调试] 已连接，socket.id=${socketId}`);
      console.log('[PhoneBridge][连接调试] connect 事件', { socketId, time: new Date().toISOString() });
      showToast('success', '已连接到服务器 ✓');
      updatePanelStatus();
      
      // 【测试】延迟5秒再发送同步，观察连接是否稳定
      console.log('[PhoneBridge][连接调试] 等待5秒后再发送同步...');
      setTimeout(() => {
        if (isConnected && socket?.connected) {
          console.log('[PhoneBridge][连接调试] 5秒后连接仍然存在，开始同步');
          sendFullSync();
          startAutoSync();
        } else {
          console.log('[PhoneBridge][连接调试] 5秒后连接已断开，跳过同步');
        }
      }, 5000);
    });

    socket.on('disconnect', (reason) => {
      const socketId = socket?.id || 'unknown';
      console.log('[PhoneBridge][连接调试] disconnect 事件', { 
        reason, 
        socketId, 
        wasReplaced,
        time: new Date().toISOString(),
        stack: new Error().stack 
      });
      log(`[连接调试] 断开连接: reason=${reason}, socketId=${socketId}, wasReplaced=${wasReplaced}`);
      
      isConnected = false;
      isConnecting = false;
      stopAutoSync();
      showToast('warning', `连接断开: ${reason}`);
      updatePanelStatus();
      
      // 如果被替换，不自动重连
      if (!wasReplaced) {
        log('[连接调试] 将在5秒后尝试重连');
        scheduleReconnect();
      } else {
        log('[连接调试] 被替换，不重连');
      }
    });

    socket.on('connect_error', (err) => {
      console.log('[PhoneBridge][连接调试] connect_error 事件', { 
        message: err.message, 
        time: new Date().toISOString() 
      });
      log(`[连接调试] 连接错误: ${err.message}`);
      isConnecting = false;
      error('连接错误:', err.message);
      showToast('error', `连接失败: ${err.message}`);
      updatePanelStatus();
      scheduleReconnect();
    });

    socket.on('replaced', (data) => {
      console.log('[PhoneBridge][连接调试] replaced 事件', { 
        data, 
        time: new Date().toISOString() 
      });
      log(`[连接调试] 被替换: ${JSON.stringify(data)}`);
      warn('被新平台替换:', data);
      showToast('warning', '被新连接替换，不会自动重连');
      wasReplaced = true;  // 标记被替换，禁止自动重连
      isConnected = false;
      isConnecting = false;
      stopAutoSync();
      updatePanelStatus();
    });

    socket.on('request_sync', (data) => {
      log('收到同步请求:', data);
      if (data?.floorRange) {
        CONFIG.floorRange = data.floorRange;
        updatePanelConfig();
      }
      sendFullSync();
    });

    socket.on('command', (command) => {
      log('收到命令:', command);
      handleCommand(command);
    });

    socket.on('config_sync', (data) => {
      log('收到配置同步:', data);
      // 暂时禁用配置同步处理，排查重连问题
      // handleConfigSync(data);
      log('[调试] 跳过配置同步处理');
    });

    socket.on('ping', (data) => {
      lastPingTime = data?.timestamp || Date.now();
      socket.emit('pong', { 
        timestamp: Date.now(),
        isGenerating: isGenerating,
        generationDuration: isGenerating && generationStartTime 
          ? Date.now() - generationStartTime 
          : null,
      });
      lastPongTime = Date.now();
      latency = lastPongTime - lastPingTime;
      updatePanelStatus();
    });
  } catch (e) {
    isConnecting = false;
    error('连接失败:', e);
    showToast('error', `连接异常: ${e.message || e}`);
    updatePanelStatus();
    scheduleReconnect();
  }
}

function disconnect() {
  // 清理重连定时器
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopAutoSync();

  // 彻底清理 socket
  if (socket) {
    // 移除所有事件监听器，防止回调触发
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  // 重置状态
  isConnected = false;
  isConnecting = false;
  wasReplaced = false;  // 手动断开时重置替换标记
  
  log('已断开连接');
  showToast('info', '已断开连接');
  updatePanelStatus();
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!isConnected) {
      log('尝试重连...');
      connect();
    }
  }, CONFIG.reconnectInterval);
}

// ============ 自动同步 ============

function startAutoSync() {
  if (!CONFIG.autoSync) return;
  stopAutoSync();
  
  autoSyncTimer = setInterval(() => {
    if (isConnected) {
      sendFullSync(true);
    }
  }, CONFIG.syncInterval);
  
  log(`自动同步已启动，间隔 ${CONFIG.syncInterval}ms`);
}

function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

// ============ 数据同步 ============

function sendFullSync(silent = false, force = false) {
  console.log('[PhoneBridge][同步调试] sendFullSync 开始');
  
  if (!isConnected || !socket) {
    if (!silent) {
      warn('未连接，无法同步');
      showToast('warning', '未连接到服务器');
    }
    return;
  }

  if (isGenerating && !force) {
    log('AI 正在生成中，跳过数据同步');
    return;
  }

  try {
    console.log('[PhoneBridge][同步调试] 步骤1: getOrCreateSessionId');
    const sessionId = getOrCreateSessionId();
    console.log('[PhoneBridge][同步调试] sessionId:', sessionId);
    
    console.log('[PhoneBridge][同步调试] 步骤2: getLastMsgId');
    const lastId = getLastMsgId();
    console.log('[PhoneBridge][同步调试] lastId:', lastId);
    
    if (lastId < 0) {
      log('没有消息可同步');
      return;
    }

    const startId = Math.max(0, lastId - CONFIG.floorRange + 1);
    console.log('[PhoneBridge][同步调试] 步骤3: getMessages, range:', `${startId}-${lastId}`);
    
    // 获取所有消息，不过滤隐藏状态（assistant 消息可能被标记为隐藏）
    const messages = getMessages(`${startId}-${lastId}`, { hide_state: 'all' });
    console.log('[PhoneBridge][同步调试] messages.length:', messages?.length);
    
    console.log('[PhoneBridge][同步调试] 步骤4: getPhoneData');
    const phoneData = getPhoneData();
    console.log('[PhoneBridge][同步调试] phoneData keys:', Object.keys(phoneData || {}));

  // 调试输出：详细打印每条消息
  if (CONFIG.debug) {
    log(`========== 消息调试 ==========`);
    log(`获取范围: ${startId} - ${lastId}，共 ${messages.length} 条 (过滤: unhidden)`);
    messages.forEach((msg, idx) => {
      log(`[${idx}] ID=${msg.message_id}, role=${msg.role}, name="${msg.name}", hidden=${msg.is_hidden}`);
      log(`    内容前100字: ${(msg.message || '').substring(0, 100).replace(/\n/g, '\\n')}...`);
    });
    
    // 对比：获取所有消息（包括隐藏的）
    const allMessages = getMessages(`${startId}-${lastId}`, {});
    log(`---------- 所有消息（含隐藏）: ${allMessages.length} 条 ----------`);
    allMessages.forEach((msg, idx) => {
      const marker = msg.is_hidden ? '[隐藏]' : '';
      log(`[${idx}] ID=${msg.message_id}, role=${msg.role}, name="${msg.name}" ${marker}`);
    });
    
    // 统计各角色数量
    const roleCount = { user: 0, assistant: 0, system: 0 };
    allMessages.forEach(msg => {
      if (roleCount[msg.role] !== undefined) roleCount[msg.role]++;
    });
    log(`角色统计: user=${roleCount.user}, assistant=${roleCount.assistant}, system=${roleCount.system}`);
    log(`==============================`);
  }

  console.log('[PhoneBridge][同步调试] 步骤5: 构建 syncData');
  const syncData = {
    type: 'full_sync',
    platform: 'sillytavern',
    chatId: sessionId,
    characterName: getCharacterName(),
    playerName: getPlayerName(),
    timestamp: Date.now(),
    payload: {
      sessionId: sessionId,
      messages: messages,
      messageRange: { start: startId, end: lastId },
      contacts: phoneData.contacts?.list || [],
      moments: phoneData.moments?.list || [],
      emails: phoneData.emails?.list || [],
    },
  };
  
  // 检查数据大小
  const dataStr = JSON.stringify(syncData);
  console.log('[PhoneBridge][同步调试] syncData 大小:', dataStr.length, '字符');
  console.log('[PhoneBridge][同步调试] socket 状态:', socket?.connected);

  console.log('[PhoneBridge][同步调试] 步骤6: socket.emit');
  socket.emit('sync', syncData);
  console.log('[PhoneBridge][同步调试] emit 完成，socket 状态:', socket?.connected);
  
  lastSyncTime = Date.now();
  syncCount++;
  log(`已同步 ${messages.length} 条消息 (范围: ${startId}-${lastId})`);
  updatePanelStatus();
  
  if (!silent) {
    showToast('success', `已同步 ${messages.length} 条消息`);
  }
  
  console.log('[PhoneBridge][同步调试] sendFullSync 完成');
  } catch (e) {
    console.error('[PhoneBridge][同步调试] sendFullSync 异常:', e);
    error('同步失败:', e);
  }
}

function sendEvent(type, payload, force = false) {
  if (!isConnected || !socket) return;

  if (isGenerating && !force) {
    log(`AI 正在生成中，跳过事件: ${type}`);
    return;
  }

  const sessionId = getOrCreateSessionId();
  
  socket.emit('sync', {
    type,
    platform: 'sillytavern',
    chatId: sessionId,
    characterName: getCharacterName(),
    playerName: getPlayerName(),
    timestamp: Date.now(),
    payload: {
      ...payload,
      sessionId: sessionId,
    },
  });

  log(`已发送事件: ${type}`);
}

// ============ 配置同步 ============

function handleConfigSync(data) {
  if (!data?.config) return;
  
  const config = data.config;
  let changed = false;
  
  if (typeof config.floorRange === 'number' && config.floorRange !== CONFIG.floorRange) {
    CONFIG.floorRange = config.floorRange;
    changed = true;
  }
  
  if (typeof config.autoSync === 'boolean' && config.autoSync !== CONFIG.autoSync) {
    CONFIG.autoSync = config.autoSync;
    if (CONFIG.autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    changed = true;
  }
  
  if (typeof config.syncInterval === 'number' && config.syncInterval !== CONFIG.syncInterval) {
    CONFIG.syncInterval = config.syncInterval;
    if (CONFIG.autoSync) {
      startAutoSync();
    }
    changed = true;
  }
  
  if (changed) {
    log('配置已更新:', CONFIG);
    showToast('info', '配置已同步');
    saveConfig();
    updatePanelConfig();
  }
}

function sendConfigUpdate(config) {
  if (!isConnected || !socket) {
    warn('未连接，无法发送配置');
    return;
  }
  
  socket.emit('config_update', {
    type: 'config_update',
    source: 'platform',
    config: config,
    timestamp: Date.now(),
  });
  
  log('已发送配置更新:', config);
}

// ============ 命令处理 ============

function handleCommand(command) {
  if (!command || !command.type) {
    warn('无效命令:', command);
    return;
  }

  switch (command.type) {
    case 'send_message':
      log('收到发送消息命令:', command.content);
      break;

    case 'get_data':
      sendFullSync();
      break;

    case 'update_config':
      if (command.config) {
        handleConfigSync({ config: command.config });
      }
      break;

    default:
      log('未知命令类型:', command.type);
  }
}

// ============ 事件监听 ============

function setupEventListeners() {
  if (typeof eventOn !== 'function' || typeof tavern_events === 'undefined') {
    warn('eventOn 或 tavern_events 不可用');
    return;
  }

  // LLM 生成状态监听
  eventOn(tavern_events.GENERATION_STARTED, (type, option, dry_run) => {
    if (dry_run) {
      log('预览模式，不标记为生成中');
      return;
    }
    
    isGenerating = true;
    generationStartTime = Date.now();
    log('AI 生成开始，暂停数据同步', { type, option });
    updatePanelStatus();
    
    if (isConnected && socket) {
      socket.emit('generation_status', {
        status: 'started',
        timestamp: generationStartTime,
        sessionId: getOrCreateSessionId(),
      });
    }
  });

  eventOn(tavern_events.GENERATION_ENDED, (messageId) => {
    const wasGenerating = isGenerating;
    const duration = generationStartTime ? Date.now() - generationStartTime : 0;
    
    isGenerating = false;
    generationStartTime = null;
    log('AI 生成结束，恢复数据同步', { messageId, duration: `${duration}ms` });
    updatePanelStatus();
    
    if (isConnected && socket) {
      socket.emit('generation_status', {
        status: 'ended',
        messageId: messageId,
        duration: duration,
        sessionId: getOrCreateSessionId(),
      });
    }
    
    if (wasGenerating && isConnected) {
      setTimeout(() => {
        sendFullSync(true, true);
      }, 100);
    }
  });

  eventOn(tavern_events.GENERATION_STOPPED, () => {
    const wasGenerating = isGenerating;
    const duration = generationStartTime ? Date.now() - generationStartTime : 0;
    
    isGenerating = false;
    generationStartTime = null;
    log('AI 生成被停止，恢复数据同步', { duration: `${duration}ms` });
    updatePanelStatus();
    
    if (isConnected && socket) {
      socket.emit('generation_status', {
        status: 'stopped',
        duration: duration,
        sessionId: getOrCreateSessionId(),
      });
    }
    
    if (wasGenerating && isConnected) {
      setTimeout(() => {
        sendFullSync(true, true);
      }, 100);
    }
  });

  // 消息事件监听
  eventOn(tavern_events.MESSAGE_RECEIVED, (messageId, type) => {
    log('消息接收:', messageId, type);
    
    if (isGenerating) {
      log('生成中收到消息更新，跳过同步');
      return;
    }
    
    const sessionId = getOrCreateSessionId();
    const msg = getMessages(messageId)[0];
    sendEvent('message_received', { 
      messageId, 
      message: msg,
      sessionId: sessionId,
    });
    sendFullSync(true);
  });

  eventOn(tavern_events.MESSAGE_EDITED, (messageId) => {
    log('消息编辑:', messageId);
    
    if (isGenerating) {
      log('生成中收到消息编辑，跳过同步');
      return;
    }
    
    const sessionId = getOrCreateSessionId();
    const msg = getMessages(messageId)[0];
    sendEvent('message_edited', { 
      messageId, 
      message: msg,
      sessionId: sessionId,
    });
  });

  eventOn(tavern_events.MESSAGE_DELETED, (messageId) => {
    log('消息删除:', messageId);
    
    if (isGenerating) {
      log('生成中收到消息删除，跳过同步');
      return;
    }
    
    const sessionId = getOrCreateSessionId();
    // 楼层删除需要用户确认
    sendEvent('message_deleted', { 
      messageId,
      sessionId: sessionId,
      requireConfirmation: true,  // 小手机端弹出确认对话框
    });
    sendFullSync(true);
  });

  // Swipe 切换事件监听
  eventOn(tavern_events.MESSAGE_SWIPED, (messageId) => {
    const lastMessageId = getLastMsgId();
    
    // 验证：只处理最后一楼的切换
    if (messageId !== lastMessageId) {
      log(`忽略非最后楼层的 swipe 切换: 楼层 ${messageId}, 最后楼层 ${lastMessageId}`);
      return;
    }
    
    log('Swipe 切换:', messageId);
    
    // 获取消息信息（包含 swipes）
    const msg = getMessages(messageId, { include_swipes: true })[0];
    if (!msg) {
      warn('无法获取消息信息:', messageId);
      return;
    }
    
    const sessionId = getOrCreateSessionId();
    const swipeId = msg.swipe_id !== undefined ? msg.swipe_id : 0;
    const swipeCount = msg.swipes ? msg.swipes.length : 1;
    const content = msg.swipes ? msg.swipes[swipeId] : msg.message;
    
    sendEvent('swipe_changed', {
      messageId: messageId,
      newSwipeId: swipeId,
      swipeCount: swipeCount,
      content: content,
      sessionId: sessionId,
      timestamp: Date.now(),
    }, true);  // 强制发送，不受生成状态影响
    
    // 切换 swipe 后触发全量同步
    sendFullSync(true, true);
  });

  // 新建聊天时 - 必然生成新的 sessionId
  eventOn(tavern_events.CHAT_CREATED, () => {
    log('新建聊天');
    
    // 清除缓存
    clearSessionIdCache();
    
    // 强制生成新 ID（因为是新聊天）
    const newId = generateUUID();
    log('[sessionId] 新聊天，生成新 ID:', newId);
    
    if (typeof insertOrAssignVariables === 'function') {
      insertOrAssignVariables(
        { _phone_bridge: { sessionId: newId } },
        { type: 'chat' }
      );
    }
    
    cachedSessionId = newId;
    showToast('info', `新聊天，sessionId: ${newId.substring(0, 8)}...`);
    updatePanelStatus();
  });

  // 切换聊天时 - 只有当不存在 sessionId 时才生成
  eventOn(tavern_events.CHAT_CHANGED, (chatFileName) => {
    log('聊天切换:', chatFileName);
    
    // 清除缓存（重要：因为切换到了新聊天）
    clearSessionIdCache();
    
    // 尝试从聊天变量读取（不自动创建）
    let existingId = null;
    try {
      if (typeof getVariables === 'function') {
        const chatVars = getVariables({ type: 'chat' });
        existingId = _.get(chatVars, SESSION_ID_PATH);
        log('[sessionId] 切换聊天，读取到:', existingId, 'type:', typeof existingId);
      }
    } catch (e) {
      error('读取 sessionId 失败:', e);
    }
    
    // 检查是否有效
    if (existingId && typeof existingId === 'string' && existingId.trim() !== '') {
      // 使用已有的 ID
      cachedSessionId = existingId;
      log('[sessionId] 使用已有 ID:', existingId);
    } else {
      // 不存在，生成新的
      const newId = generateUUID();
      log('[sessionId] 不存在，生成新 ID:', newId);
      
      if (typeof insertOrAssignVariables === 'function') {
        insertOrAssignVariables(
          { _phone_bridge: { sessionId: newId } },
          { type: 'chat' }
        );
      }
      cachedSessionId = newId;
    }
    
    showToast('info', `聊天切换，sessionId: ${cachedSessionId.substring(0, 8)}...`);
    updatePanelStatus();
    
    log('[调试] 跳过 CHAT_CHANGED 的自动重连');
  });

  log('事件监听器已设置');
}

// ============ 面板 UI ============

function createPanel() {
  // 检查是否已存在（使用 jQuery）
  if ($(`#${PANEL_ID}`).length) {
    panelElement = $(`#${PANEL_ID}`)[0];
    log('面板已存在');
    return;
  }

  const sessionId = getSessionId() || '(未生成)';
  const shortSessionId = sessionId.length > 16 ? sessionId.substring(0, 8) + '...' : sessionId;

  const panelHTML = `
    <div id="${PANEL_ID}" class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>📱 小手机桥接</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>

      <div class="inline-drawer-content">
        <!-- 连接状态 -->
        <div class="flex-container flexFlowColumn" style="margin-bottom: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: bold;">连接状态</span>
            <span id="${PANEL_ID}-status" class="phone-bridge-status disconnected">
              <i class="fa-solid fa-circle"></i>
              <span>未连接</span>
            </span>
          </div>
          
          <div id="${PANEL_ID}-info" style="font-size: 0.85em; color: var(--SmartThemeQuoteColor); line-height: 1.6;">
            <div>Session ID: <code id="${PANEL_ID}-session-id" title="${sessionId}" style="cursor: pointer;">${shortSessionId}</code></div>
            <div>延迟: <span id="${PANEL_ID}-latency">--</span> ms</div>
            <div>同步次数: <span id="${PANEL_ID}-sync-count">0</span></div>
            <div>上次同步: <span id="${PANEL_ID}-last-sync">--</span></div>
            <div id="${PANEL_ID}-generating" style="display: none; color: var(--SmartThemeWarningColor);">
              <i class="fa-solid fa-spinner fa-spin"></i> AI 生成中...
            </div>
          </div>
        </div>

        <hr />

        <!-- 操作按钮 -->
        <div class="flex-container" style="gap: 8px; margin-bottom: 10px;">
          <button id="${PANEL_ID}-connect-btn" class="menu_button" style="flex: 1;">
            <i class="fa-solid fa-plug"></i> 连接
          </button>
          <button id="${PANEL_ID}-sync-btn" class="menu_button" style="flex: 1;">
            <i class="fa-solid fa-sync"></i> 同步
          </button>
        </div>

        <hr />

        <!-- 服务器配置 -->
        <div class="flex-container flexFlowColumn" style="margin-bottom: 10px;">
          <label>服务器地址</label>
          <input id="${PANEL_ID}-server-url" class="text_pole" type="text" value="${CONFIG.serverUrl}" autocomplete="off" />
        </div>

        <div class="flex-container flexFlowColumn" style="margin-bottom: 10px;">
          <label>API Key <small style="color: var(--SmartThemeQuoteColor);">(留空禁用鉴权)</small></label>
          <input id="${PANEL_ID}-api-key" class="text_pole" type="password" value="${CONFIG.apiKey}" autocomplete="off" placeholder="可选" />
        </div>

        <hr />

        <!-- 同步配置 -->
        <div class="flex-container flexFlowColumn" style="margin-bottom: 10px;">
          <label>同步楼层数</label>
          <input id="${PANEL_ID}-floor-range" class="text_pole" type="number" min="1" max="100" value="${CONFIG.floorRange}" />
        </div>

        <div class="flex-container" style="align-items: center; margin-bottom: 10px;">
          <input id="${PANEL_ID}-auto-sync" type="checkbox" ${CONFIG.autoSync ? 'checked' : ''} />
          <label for="${PANEL_ID}-auto-sync" style="margin-left: 8px;">自动同步</label>
        </div>

        <div class="flex-container flexFlowColumn" style="margin-bottom: 10px;">
          <label>同步间隔 (毫秒)</label>
          <input id="${PANEL_ID}-sync-interval" class="text_pole" type="number" min="1000" max="60000" step="1000" value="${CONFIG.syncInterval}" />
        </div>

        <div class="flex-container" style="align-items: center; margin-bottom: 10px;">
          <input id="${PANEL_ID}-auto-connect" type="checkbox" ${CONFIG.autoConnect ? 'checked' : ''} />
          <label for="${PANEL_ID}-auto-connect" style="margin-left: 8px;">自动连接</label>
        </div>

        <div class="flex-container" style="align-items: center; margin-bottom: 10px;">
          <input id="${PANEL_ID}-debug" type="checkbox" ${CONFIG.debug ? 'checked' : ''} />
          <label for="${PANEL_ID}-debug" style="margin-left: 8px;">调试模式</label>
        </div>

        <hr />

        <!-- 日志区域 -->
        <div class="flex-container flexFlowColumn">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <label>日志</label>
            <button id="${PANEL_ID}-clear-log" class="menu_button" style="padding: 2px 8px; font-size: 0.8em;">
              清空
            </button>
          </div>
          <div id="${PANEL_ID}-log" style="
            height: 120px;
            overflow-y: auto;
            background: var(--SmartThemeBlurTintColor);
            border: 1px solid var(--SmartThemeBorderColor);
            border-radius: 4px;
            padding: 8px;
            font-size: 0.75em;
            font-family: monospace;
            line-height: 1.4;
          "></div>
        </div>
      </div>
    </div>

    <style>
      #${PANEL_ID} .phone-bridge-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.85em;
      }
      #${PANEL_ID} .phone-bridge-status.connected {
        background: rgba(40, 167, 69, 0.2);
        color: #28a745;
      }
      #${PANEL_ID} .phone-bridge-status.disconnected {
        background: rgba(220, 53, 69, 0.2);
        color: #dc3545;
      }
      #${PANEL_ID} .phone-bridge-status.connecting {
        background: rgba(255, 193, 7, 0.2);
        color: #ffc107;
      }
      #${PANEL_ID} .log-entry {
        margin-bottom: 2px;
        word-break: break-all;
      }
      #${PANEL_ID} .log-entry.info { color: var(--SmartThemeBodyColor); }
      #${PANEL_ID} .log-entry.warn { color: #ffc107; }
      #${PANEL_ID} .log-entry.error { color: #dc3545; }
      #${PANEL_ID} code {
        background: var(--SmartThemeBlurTintColor);
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 0.9em;
      }
    </style>
  `;

  // 使用 jQuery 创建并注入面板
  const $panel = $(panelHTML);
  const $target = $('#extensions_settings2');
  
  if ($target.length) {
    $target.append($panel);
    panelElement = $panel[0];
    log('面板已注入');
    // 绑定事件
    setupPanelEvents();
  } else {
    warn('未找到 #extensions_settings2 容器');
  }
}

function setupPanelEvents() {
  // 使用 jQuery 绑定事件
  const $panel = $(`#${PANEL_ID}`);
  
  // 连接按钮
  $panel.find(`#${PANEL_ID}-connect-btn`).on('click', function() {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  });

  // 同步按钮
  $panel.find(`#${PANEL_ID}-sync-btn`).on('click', function() {
    if (isConnected) {
      sendFullSync(false, true);  // 强制同步
    } else {
      showToast('warning', '请先连接到服务器');
    }
  });

  // Session ID 点击复制
  $panel.find(`#${PANEL_ID}-session-id`).on('click', function() {
    const sessionId = getOrCreateSessionId();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sessionId).then(() => {
        showToast('success', 'Session ID 已复制');
      });
    }
  });

  // 服务器地址
  $panel.find(`#${PANEL_ID}-server-url`).on('change', function() {
    CONFIG.serverUrl = $(this).val().trim();
    saveConfig();
    log('服务器地址已更新:', CONFIG.serverUrl);
    if (isConnected) {
      showToast('info', '需要重新连接以使用新地址');
    }
  });

  // API Key
  $panel.find(`#${PANEL_ID}-api-key`).on('change', function() {
    CONFIG.apiKey = $(this).val().trim();
    saveConfig();
    log('API Key 已更新');
    if (isConnected) {
      showToast('info', '需要重新连接以使用新 API Key');
    }
  });

  // 同步楼层数
  $panel.find(`#${PANEL_ID}-floor-range`).on('change', function() {
    const value = parseInt($(this).val());
    if (!isNaN(value) && value > 0 && value <= 100) {
      CONFIG.floorRange = value;
      saveConfig();
      sendConfigUpdate({ floorRange: value });
      log('同步楼层数已更新:', value);
    }
  });

  // 自动同步
  $panel.find(`#${PANEL_ID}-auto-sync`).on('change', function() {
    CONFIG.autoSync = $(this).prop('checked');
    saveConfig();
    if (CONFIG.autoSync && isConnected) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
    log('自动同步:', CONFIG.autoSync ? '开启' : '关闭');
  });

  // 同步间隔
  $panel.find(`#${PANEL_ID}-sync-interval`).on('change', function() {
    const value = parseInt($(this).val());
    if (!isNaN(value) && value >= 1000) {
      CONFIG.syncInterval = value;
      saveConfig();
      if (CONFIG.autoSync && isConnected) {
        startAutoSync();
      }
      log('同步间隔已更新:', value, 'ms');
    }
  });

  // 自动连接
  $panel.find(`#${PANEL_ID}-auto-connect`).on('change', function() {
    CONFIG.autoConnect = $(this).prop('checked');
    saveConfig();
    log('自动连接:', CONFIG.autoConnect ? '开启' : '关闭');
  });

  // 调试模式
  $panel.find(`#${PANEL_ID}-debug`).on('change', function() {
    CONFIG.debug = $(this).prop('checked');
    saveConfig();
    log('调试模式:', CONFIG.debug ? '开启' : '关闭');
  });

  // 清空日志
  $panel.find(`#${PANEL_ID}-clear-log`).on('click', function() {
    $panel.find(`#${PANEL_ID}-log`).empty();
  });
  
  log('面板事件已绑定');
}

function updatePanelStatus() {
  const $panel = $(`#${PANEL_ID}`);
  if (!$panel.length) return;

  // 更新连接状态
  const $status = $panel.find(`#${PANEL_ID}-status`);
  if ($status.length) {
    $status.removeClass('connected disconnected').addClass(isConnected ? 'connected' : 'disconnected');
    $status.find('span').text(isConnected ? '已连接' : '未连接');
  }

  // 更新连接按钮
  const $connectBtn = $panel.find(`#${PANEL_ID}-connect-btn`);
  if ($connectBtn.length) {
    $connectBtn.html(isConnected 
      ? '<i class="fa-solid fa-plug-circle-xmark"></i> 断开' 
      : '<i class="fa-solid fa-plug"></i> 连接');
  }

  // 更新 Session ID
  const $sessionId = $panel.find(`#${PANEL_ID}-session-id`);
  if ($sessionId.length) {
    const sessionId = getSessionId() || '(未生成)';
    const shortId = sessionId.length > 16 ? sessionId.substring(0, 8) + '...' : sessionId;
    $sessionId.text(shortId).attr('title', sessionId);
  }

  // 更新延迟
  $panel.find(`#${PANEL_ID}-latency`).text(latency !== null ? latency : '--');

  // 更新同步次数
  $panel.find(`#${PANEL_ID}-sync-count`).text(syncCount);

  // 更新上次同步时间
  const $lastSync = $panel.find(`#${PANEL_ID}-last-sync`);
  if (lastSyncTime) {
    const date = new Date(lastSyncTime);
    $lastSync.text(date.toLocaleTimeString());
  } else {
    $lastSync.text('--');
  }

  // 更新生成状态
  $panel.find(`#${PANEL_ID}-generating`).toggle(isGenerating);
}

function updatePanelConfig() {
  const $panel = $(`#${PANEL_ID}`);
  if (!$panel.length) return;

  $panel.find(`#${PANEL_ID}-floor-range`).val(CONFIG.floorRange);
  $panel.find(`#${PANEL_ID}-auto-sync`).prop('checked', CONFIG.autoSync);
  $panel.find(`#${PANEL_ID}-sync-interval`).val(CONFIG.syncInterval);
}

function appendLog(level, message) {
  const $log = $(`#${PANEL_ID}-log`);
  if (!$log.length) return;

  const time = new Date().toLocaleTimeString();
  const $entry = $(`<div class="log-entry ${level}">[${time}] ${message}</div>`);
  $log.append($entry);

  // 限制日志条数
  while ($log.children().length > 50) {
    $log.children().first().remove();
  }

  // 滚动到底部
  $log.scrollTop($log[0].scrollHeight);
}

function destroyPanel() {
  const $panel = $(`#${PANEL_ID}`);
  if ($panel.length) {
    $panel.remove();
    panelElement = null;
    log('面板已销毁');
  }
}

// ============ 按钮设置 (保留兼容性) ============

function setupButtons() {
  if (typeof replaceScriptButtons !== 'function') {
    warn('replaceScriptButtons 不可用');
    return;
  }

  replaceScriptButtons([
    { name: '🔌 连接', visible: true },
    { name: '🔄 同步', visible: true },
  ]);

  if (typeof eventOn !== 'function' || typeof getButtonEvent !== 'function') {
    return;
  }

  eventOn(getButtonEvent('🔌 连接'), () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  });

  eventOn(getButtonEvent('🔄 同步'), () => {
    if (isConnected) {
      sendFullSync(false, true);
    } else {
      showToast('warning', '请先连接到服务器');
    }
  });

  log('按钮已设置');
}

// ============ 初始化 ============

function init() {
  log('脚本初始化...');
  
  // 加载保存的配置
  loadConfig();
  log('配置:', CONFIG);
  
  // 获取或创建 sessionId
  const sessionId = getOrCreateSessionId();
  log('当前 Session ID:', sessionId);

  // 创建面板 UI
  createPanel();

  // 设置事件监听
  setupEventListeners();
  
  // 设置按钮（兼容性）
  setupButtons();

  // 自动连接
  if (CONFIG.autoConnect) {
    setTimeout(connect, 1000);
  } else {
    showToast('success', '脚本就绪，打开扩展面板进行配置');
  }

  log('脚本就绪');
}

// 清理函数
function cleanup() {
  disconnect();
  destroyPanel();
  log('脚本已清理');
}

// 使用 jQuery ready 确保 DOM 加载完成
$(() => {
  // 页面卸载时清理
  $(window).on('pagehide', () => {
    console.log('[PhoneBridge][连接调试] pagehide 事件触发！', new Date().toISOString());
    cleanup();
  });
  
  // 检测 beforeunload
  $(window).on('beforeunload', () => {
    console.log('[PhoneBridge][连接调试] beforeunload 事件触发！', new Date().toISOString());
  });
  
  // 检测 unload
  $(window).on('unload', () => {
    console.log('[PhoneBridge][连接调试] unload 事件触发！', new Date().toISOString());
  });

  // 启动
  init();
});
