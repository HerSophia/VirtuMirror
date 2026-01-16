/**
 * 事件系统相关类型和函数
 * 用于监听和发送事件
 */

/* eslint-disable @typescript-eslint/no-unsafe-function-type */

/**
 * 事件可以是
 * - `iframe_events` 中的 iframe 事件
 * - `tavern_events` 中的酒馆事件
 * - 自定义的字符串事件
 */
type EventType = IframeEventType | TavernEventType | string;

type EventOnReturn = {
  /** 取消监听 */
  stop: () => void;
};

/**
 * 让 `listener` 监听 `event_type`, 当事件发生时自动运行 `listener`;
 * 如果 `listener` 已经在监听 `event_type`, 则调用本函数不会有任何效果.
 *
 * 当 `eventOn` 所在的前端界面/脚本关闭时, 监听将会自动卸载.
 *
 * @param event_type 要监听的事件
 * @param listener 要注册的函数
 *
 * @example
 * function hello() { alert("hello"); }
 * eventOn(要监听的事件, hello);
 *
 * @example
 * // 监听消息接收并弹出 `'hello'`
 * eventOn(tavern_events.MESSAGE_RECEIVED, () => alert('hello'));
 *
 * @example
 * // 消息被修改时监听是哪一条消息被修改
 * // 酒馆事件 tavern_events.MESSAGE_UPDATED 会传递被更新的楼层 id
 * eventOn(tavern_events.MESSAGE_UPDATED, message_id => {
 *   alert(`你刚刚更新了第 ${message_id} 条聊天消息对吧😡`);
 * });
 *
 * @returns 后续操作
 *   - `stop`: 取消这个监听
 */
declare function eventOn<T extends EventType>(event_type: T, listener: ListenerType[T]): EventOnReturn;

/** @deprecated 请使用 `eventOn(getButtonEvent('按钮名称'), 函数)` 代替 */
declare function eventOnButton<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * 让 `listener` 监听 `event_type`, 当事件发生时自动在最后运行 `listener`;
 * 如果 `listener` 已经在监听 `event_type`, 则调用本函数会将 `listener` 调整为最后运行.
 *
 * 当 `eventMakeLast` 所在的前端界面/脚本关闭时, 监听将会自动卸载.
 *
 * @param event_type 要监听的事件
 * @param listener 要注册/调整到最后运行的函数
 *
 * @example
 * eventMakeLast(要监听的事件, 要注册的函数);
 *
 * @returns 后续操作
 *   - `stop`: 取消这个监听
 */
declare function eventMakeLast<T extends EventType>(event_type: T, listener: ListenerType[T]): EventOnReturn;

/**
 * 让 `listener` 监听 `event_type`, 当事件发生时自动在最先运行 `listener`;
 * 如果 `listener` 已经在监听 `event_type`, 则调用本函数会将 `listener` 调整为最先运行.
 *
 * 当 `eventMakeFirst` 所在的前端界面/脚本关闭时, 监听将会自动卸载.
 *
 * @param event_type 要监听的事件
 * @param listener 要注册/调整为最先运行的函数
 *
 * @example
 * eventMakeFirst(要监听的事件, 要注册的函数);
 *
 * @returns 后续操作
 *   - `stop`: 取消这个监听
 */
declare function eventMakeFirst<T extends EventType>(event_type: T, listener: ListenerType[T]): EventOnReturn;

/**
 * 让 `listener` 仅监听下一次 `event_type`, 当该次事件发生时运行 `listener`, 此后取消监听;
 * 如果 `listener` 已经在监听 `event_type`, 则调用本函数不会有任何效果.
 *
 * 当 `eventOnce` 所在的前端界面/脚本关闭时, 监听将会自动卸载.
 *
 * @param event_type 要监听的事件
 * @param listener 要注册的函数
 *
 * @example
 * eventOnce(要监听的事件, 要注册的函数);
 *
 * @returns 后续操作
 *   - `stop`: 取消这个监听
 */
declare function eventOnce<T extends EventType>(event_type: T, listener: ListenerType[T]): EventOnReturn;

/**
 * 发送 `event_type` 事件, 同时可以发送一些数据 `data`.
 *
 * 所有正在监听 `event_type` 消息频道的都会收到该消息并接收到 `data`.
 *
 * @param event_type 要发送的事件
 * @param data 要随着事件发送的数据
 *
 * @example
 * // 发送 "角色阶段更新完成" 事件, 所有监听该事件的 `listener` 都会被运行
 * eventEmit("角色阶段更新完成");
 *
 * @example
 * // 发送 "存档" 事件, 并等待所有 `listener` (也许是负责存档的函数) 执行完毕后才继续
 * await eventEmit("存档");
 *
 * @example
 * // 发送时携带数据 ["你好", 0]
 * eventEmit("事件", "你好", 0);
 */
declare function eventEmit<T extends EventType>(event_type: T, ...data: Parameters<ListenerType[T]>): Promise<void>;

/**
 * 携带 `data` 而发送 `event_type` 事件并等待事件处理结束.
 *
 * @param event_type 要发送的事件
 * @param data 要随着事件发送的数据
 */
declare function eventEmitAndWait<T extends EventType>(event_type: T, ...data: Parameters<ListenerType[T]>): void;

/**
 * 让 `listener` 取消对 `event_type` 的监听; 如果 `listener` 没有监听 `event_type`, 则调用本函数不会有任何效果.
 *
 * 前端界面/脚本关闭时会自动卸载所有的事件监听, 你不必手动调用 `eventRemoveListener` 来移除.
 *
 * @param event_type 要监听的事件
 * @param listener 要取消注册的函数
 *
 * @example
 * eventRemoveListener(要监听的事件, 要取消注册的函数);
 */
declare function eventRemoveListener<T extends EventType>(event_type: T, listener: ListenerType[T]): void;

/**
 * 取消本 iframe 中对 `event_type` 的所有监听
 *
 * 前端界面/脚本关闭时会自动卸载所有的事件监听, 你不必手动调用 `eventClearEvent` 来移除.
 *
 * @param event_type 要取消监听的事件
 */
declare function eventClearEvent(event_type: EventType): void;

/**
 * 取消本 iframe 中 `listener` 的的所有监听
 *
 * 前端界面/脚本关闭时会自动卸载所有的事件监听, 你不必手动调用 `eventClearListener` 来移除.
 *
 * @param listener 要取消注册的函数
 */
declare function eventClearListener(listener: Function): void;

/**
 * 取消本 iframe 中对所有事件的所有监听
 *
 * 前端界面/脚本关闭时会自动卸载所有的事件监听, 你不必手动调用 `eventClearAll` 来移除.
 */
declare function eventClearAll(): void;

//------------------------------------------------------------------------------------------------------------------------
// 以下是可用的事件, 你可以发送和监听它们

type IframeEventType = (typeof iframe_events)[keyof typeof iframe_events];

// iframe 事件
declare const iframe_events: {
  MESSAGE_IFRAME_RENDER_STARTED: 'message_iframe_render_started';
  MESSAGE_IFRAME_RENDER_ENDED: 'message_iframe_render_ended';
  /** `generate` 函数开始生成 */
  GENERATION_STARTED: 'js_generation_started';
  /** 启用流式传输的 `generate` 函数传输当前完整文本: "这是", "这是一条", "这是一条流式传输" */
  STREAM_TOKEN_RECEIVED_FULLY: 'js_stream_token_received_fully';
  /** 启用流式传输的 `generate` 函数传输当前增量文本: "这是", "一条", "流式传输" */
  STREAM_TOKEN_RECEIVED_INCREMENTALLY: 'js_stream_token_received_incrementally';
  /** `generate` 函数完成生成 */
  GENERATION_ENDED: 'js_generation_ended';
};

type TavernEventType = (typeof tavern_events)[keyof typeof tavern_events];

// 酒馆事件. **不建议自己发送酒馆事件, 因为你并不清楚它需要发送什么数据**
declare const tavern_events: {
  APP_READY: 'app_ready';
  EXTRAS_CONNECTED: 'extras_connected';
  MESSAGE_SWIPED: 'message_swiped';
  MESSAGE_SENT: 'message_sent';
  MESSAGE_RECEIVED: 'message_received';
  MESSAGE_EDITED: 'message_edited';
  MESSAGE_DELETED: 'message_deleted';
  MESSAGE_UPDATED: 'message_updated';
  MESSAGE_FILE_EMBEDDED: 'message_file_embedded';
  IMPERSONATE_READY: 'impersonate_ready';
  CHAT_CHANGED: 'chat_id_changed';
  GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS';
  GENERATION_STARTED: 'generation_started';
  GENERATION_STOPPED: 'generation_stopped';
  GENERATION_ENDED: 'generation_ended';
  EXTENSIONS_FIRST_LOAD: 'extensions_first_load';
  EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded';
  SETTINGS_LOADED: 'settings_loaded';
  SETTINGS_UPDATED: 'settings_updated';
  GROUP_UPDATED: 'group_updated';
  MOVABLE_PANELS_RESET: 'movable_panels_reset';
  SETTINGS_LOADED_BEFORE: 'settings_loaded_before';
  SETTINGS_LOADED_AFTER: 'settings_loaded_after';
  CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed';
  CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed';
  OAI_PRESET_CHANGED_BEFORE: 'oai_preset_changed_before';
  OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after';
  OAI_PRESET_EXPORT_READY: 'oai_preset_export_ready';
  OAI_PRESET_IMPORT_READY: 'oai_preset_import_ready';
  WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated';
  WORLDINFO_UPDATED: 'worldinfo_updated';
  CHARACTER_EDITED: 'character_edited';
  CHARACTER_PAGE_LOADED: 'character_page_loaded';
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE: 'character_group_overlay_state_change_before';
  CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER: 'character_group_overlay_state_change_after';
  USER_MESSAGE_RENDERED: 'user_message_rendered';
  CHARACTER_MESSAGE_RENDERED: 'character_message_rendered';
  FORCE_SET_BACKGROUND: 'force_set_background';
  CHAT_DELETED: 'chat_deleted';
  CHAT_CREATED: 'chat_created';
  GROUP_CHAT_DELETED: 'group_chat_deleted';
  GROUP_CHAT_CREATED: 'group_chat_created';
  GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts';
  GENERATE_AFTER_COMBINE_PROMPTS: 'generate_after_combine_prompts';
  GENERATE_AFTER_DATA: 'generate_after_data';
  GROUP_MEMBER_DRAFTED: 'group_member_drafted';
  WORLD_INFO_ACTIVATED: 'world_info_activated';
  TEXT_COMPLETION_SETTINGS_READY: 'text_completion_settings_ready';
  CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready';
  CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready';
  CHARACTER_FIRST_MESSAGE_SELECTED: 'character_first_message_selected';
  // TODO: Naming convention is inconsistent with other events
  CHARACTER_DELETED: 'characterDeleted';
  CHARACTER_DUPLICATED: 'character_duplicated';
  STREAM_TOKEN_RECEIVED: 'stream_token_received';
  FILE_ATTACHMENT_DELETED: 'file_attachment_deleted';
  WORLDINFO_FORCE_ACTIVATE: 'worldinfo_force_activate';
  OPEN_CHARACTER_LIBRARY: 'open_character_library';
  ONLINE_STATUS_CHANGED: 'online_status_changed';
  IMAGE_SWIPED: 'image_swiped';
  CONNECTION_PROFILE_LOADED: 'connection_profile_loaded';
  TOOL_CALLS_PERFORMED: 'tool_calls_performed';
  TOOL_CALLS_RENDERED: 'tool_calls_rendered';
  /** since SillyTavern v1.13.2 */
  CHARACTER_MANAGEMENT_DROPDOWN: 'charManagementDropdown';
  /** since SillyTavern v1.13.2 */
  SECRET_WRITTEN: 'secret_written';
  /** since SillyTavern v1.13.2 */
  SECRET_DELETED: 'secret_deleted';
  /** since SillyTavern v1.13.2 */
  SECRET_ROTATED: 'secret_rotated';
  /** since SillyTavern v1.13.2 */
  SECRET_EDITED: 'secret_edited';
  /** since SillyTavern v1.13.2 */
  PRESET_CHANGED: 'preset_changed';
  /** since SillyTavern v1.13.2 */
  PRESET_DELETED: 'preset_deleted';
  /** since SillyTavern v1.13.5 */
  PRESET_RENAMED: 'preset_renamed';
  /** since SillyTavern v1.13.5 */
  PRESET_RENAMED_BEFORE: 'preset_renamed_before';
  /** since SillyTavern v1.13.2 */
  MAIN_API_CHANGED: 'main_api_changed';
  /** since SillyTavern v1.13.4 */
  WORLDINFO_ENTRIES_LOADED: 'worldinfo_entries_loaded';
};

interface ListenerType {
  [iframe_events.MESSAGE_IFRAME_RENDER_STARTED]: (iframe_name: string) => void;
  [iframe_events.MESSAGE_IFRAME_RENDER_ENDED]: (iframe_name: string) => void;
  [iframe_events.GENERATION_STARTED]: (id: string) => void;
  [iframe_events.STREAM_TOKEN_RECEIVED_FULLY]: (full_text: string, id: string) => void;
  [iframe_events.STREAM_TOKEN_RECEIVED_INCREMENTALLY]: (incremental_text: string, id: string) => void;
  [iframe_events.GENERATION_ENDED]: (text: string, id: string) => void;

  [tavern_events.APP_READY]: () => void;
  [tavern_events.EXTRAS_CONNECTED]: (modules: any) => void;
  [tavern_events.MESSAGE_SWIPED]: (message_id: number) => void;
  [tavern_events.MESSAGE_SENT]: (message_id: number) => void;
  [tavern_events.MESSAGE_RECEIVED]: (message_id: number, type?: string) => void;
  [tavern_events.MESSAGE_EDITED]: (message_id: number) => void;
  [tavern_events.MESSAGE_DELETED]: (message_id: number) => void;
  [tavern_events.MESSAGE_UPDATED]: (message_id: number) => void;
  [tavern_events.MESSAGE_FILE_EMBEDDED]: (message_id: number) => void;
  [tavern_events.IMPERSONATE_READY]: (message: string) => void;
  [tavern_events.CHAT_CHANGED]: (chat_file_name: string) => void;
  [tavern_events.GENERATION_AFTER_COMMANDS]: (
    type: string,
    option: {
      automatic_trigger?: boolean;
      force_name2?: boolean;
      quiet_prompt?: string;
      quietToLoud?: boolean;
      skipWIAN?: boolean;
      force_chid?: number;
      signal?: AbortSignal;
      quietImage?: string;
      quietName?: string;
      depth?: number;
    },
    dry_run: boolean,
  ) => void;
  [tavern_events.GENERATION_STARTED]: (
    type: string,
    option: {
      automatic_trigger?: boolean;
      force_name2?: boolean;
      quiet_prompt?: string;
      quietToLoud?: boolean;
      skipWIAN?: boolean;
      force_chid?: number;
      signal?: AbortSignal;
      quietImage?: string;
      quietName?: string;
      depth?: number;
    },
    dry_run: boolean,
  ) => void;
  [tavern_events.GENERATION_STOPPED]: () => void;
  [tavern_events.GENERATION_ENDED]: (message_id: number) => void;
  [tavern_events.EXTENSIONS_FIRST_LOAD]: () => void;
  [tavern_events.EXTENSION_SETTINGS_LOADED]: () => void;
  [tavern_events.SETTINGS_LOADED]: () => void;
  [tavern_events.SETTINGS_UPDATED]: () => void;
  [tavern_events.GROUP_UPDATED]: () => void;
  [tavern_events.MOVABLE_PANELS_RESET]: () => void;
  [tavern_events.SETTINGS_LOADED_BEFORE]: (settings: object) => void;
  [tavern_events.SETTINGS_LOADED_AFTER]: (settings: object) => void;
  [tavern_events.CHATCOMPLETION_SOURCE_CHANGED]: (source: string) => void;
  [tavern_events.CHATCOMPLETION_MODEL_CHANGED]: (model: string) => void;
  [tavern_events.OAI_PRESET_CHANGED_BEFORE]: (result: {
    preset: object;
    presetName: string;
    settingsToUpdate: object;
    settings: object;
    savePreset: Function;
  }) => void;
  [tavern_events.OAI_PRESET_CHANGED_AFTER]: () => void;
  [tavern_events.OAI_PRESET_EXPORT_READY]: (preset: object) => void;
  [tavern_events.OAI_PRESET_IMPORT_READY]: (result: { data: object; presetName: string }) => void;
  [tavern_events.WORLDINFO_SETTINGS_UPDATED]: () => void;
  [tavern_events.WORLDINFO_UPDATED]: (
    name: string,
    data: { entries: { [uid: number]: SillyTavern.FlattenedWorldInfoEntry } },
  ) => void;
  [tavern_events.CHARACTER_EDITED]: (result: { detail: { id: string; character: SillyTavern.v1CharData } }) => void;
  [tavern_events.CHARACTER_PAGE_LOADED]: () => void;
  [tavern_events.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE]: (state: number) => void;
  [tavern_events.CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER]: (state: number) => void;
  [tavern_events.USER_MESSAGE_RENDERED]: (message_id: number) => void;
  [tavern_events.CHARACTER_MESSAGE_RENDERED]: (message_id: number, type?: string) => void;
  [tavern_events.FORCE_SET_BACKGROUND]: (background: { url: string; path: string }) => void;
  [tavern_events.CHAT_DELETED]: (chat_file_name: string) => void;
  [tavern_events.CHAT_CREATED]: () => void;
  [tavern_events.GROUP_CHAT_DELETED]: (chat_file_name: string) => void;
  [tavern_events.GROUP_CHAT_CREATED]: () => void;
  [tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS]: () => void;
  [tavern_events.GENERATE_AFTER_COMBINE_PROMPTS]: (result: { prompt: string; dryRun: boolean }) => void;
  /** dry_run 只在 SillyTavern 1.13.15 及以后有 */
  [tavern_events.GENERATE_AFTER_DATA]: (
    generate_data: { prompt: SillyTavern.SendingMessage[] },
    dry_run: boolean,
  ) => void;
  [tavern_events.GROUP_MEMBER_DRAFTED]: (character_id: string) => void;
  [tavern_events.WORLD_INFO_ACTIVATED]: (entries: ({ world: string } & SillyTavern.FlattenedWorldInfoEntry)[]) => void;
  [tavern_events.TEXT_COMPLETION_SETTINGS_READY]: () => void;
  [tavern_events.CHAT_COMPLETION_SETTINGS_READY]: (generate_data: {
    messages: SillyTavern.SendingMessage[];
    model: string;
    temprature: number;
    frequency_penalty: number;
    presence_penalty: number;
    top_p: number;
    max_tokens: number;
    stream: boolean;
    logit_bias: object;
    stop: string[];
    chat_comletion_source: string;
    n?: number;
    user_name: string;
    char_name: string;
    group_names: string[];
    include_reasoning: boolean;
    reasoning_effort: string;
    json_schema: {
      name: string;
      value: Record<string, any>;
      description?: string;
      strict?: boolean;
    };
    [others: string]: any;
  }) => void;
  [tavern_events.CHAT_COMPLETION_PROMPT_READY]: (event_data: {
    chat: SillyTavern.SendingMessage[];
    dryRun: boolean;
  }) => void;
  [tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED]: (event_args: {
    input: string;
    output: string;
    character: object;
  }) => void;
  [tavern_events.CHARACTER_DELETED]: (result: { id: string; character: SillyTavern.v1CharData }) => void;
  [tavern_events.CHARACTER_DUPLICATED]: (result: { oldAvatar: string; newAvatar: string }) => void;
  [tavern_events.STREAM_TOKEN_RECEIVED]: (text: string) => void;
  [tavern_events.FILE_ATTACHMENT_DELETED]: (url: string) => void;
  [tavern_events.WORLDINFO_FORCE_ACTIVATE]: (entries: object[]) => void;
  [tavern_events.OPEN_CHARACTER_LIBRARY]: () => void;
  [tavern_events.ONLINE_STATUS_CHANGED]: () => void;
  [tavern_events.IMAGE_SWIPED]: (result: {
    message: object;
    element: JQuery<HTMLElement>;
    direction: 'left' | 'right';
  }) => void;
  [tavern_events.CONNECTION_PROFILE_LOADED]: (profile_name: string) => void;
  [tavern_events.TOOL_CALLS_PERFORMED]: (tool_invocations: object[]) => void;
  [tavern_events.TOOL_CALLS_RENDERED]: (tool_invocations: object[]) => void;
  [tavern_events.WORLDINFO_ENTRIES_LOADED]: (lores: {
    globalLore: ({ world: string } & SillyTavern.FlattenedWorldInfoEntry)[];
    characterLore: ({ world: string } & SillyTavern.FlattenedWorldInfoEntry)[];
    chatLore: ({ world: string } & SillyTavern.FlattenedWorldInfoEntry)[];
    personaLore: ({ world: string } & SillyTavern.FlattenedWorldInfoEntry)[];
  }) => void;
  [tavern_events.CHARACTER_MANAGEMENT_DROPDOWN]: (target: JQuery) => void;
  [tavern_events.SECRET_WRITTEN]: (secret: string) => void;
  [tavern_events.SECRET_DELETED]: (secret: string) => void;
  [tavern_events.SECRET_ROTATED]: (secret: string) => void;
  [tavern_events.SECRET_EDITED]: (secret: string) => void;
  [tavern_events.PRESET_CHANGED]: (data: { apiId: string; name: string }) => void;
  [tavern_events.PRESET_DELETED]: (data: { apiId: string; name: string }) => void;
  [tavern_events.PRESET_RENAMED]: (data: { apiId: string; oldName: string; newName: string }) => void;
  [tavern_events.PRESET_RENAMED_BEFORE]: (data: { apiId: string; oldName: string; newName: string }) => void;
  [tavern_events.MAIN_API_CHANGED]: (data: { apiId: string }) => void;
  [custom_event: string]: (...args: any) => any;
}