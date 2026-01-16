/**
 * iframe 相关函数
 * 用于在前端界面或脚本中使用
 */

/**
 * 获取按钮对应的事件类型, **只能在脚本中使用**
 *
 * @param button_name 按钮名
 * @returns 事件类型
 *
 * @example
 * const event_type = getButtonEvent('按钮名');
 * eventOn(event_type, () => {
 *   console.log('按钮被点击了');
 * });
 */
declare function getButtonEvent(button_name: string): string;

type ScriptButton = {
  name: string;
  visible: boolean;
};

/**
 * 获取脚本的按钮列表, **只能在脚本中使用**
 *
 * @returns 按钮数组
 *
 * @example
 * const buttons = getScriptButtons();
 */
declare function getScriptButtons(): ScriptButton[];

/**
 * 完全替换脚本的按钮列表, **只能在脚本中使用**
 *
 * @param buttons 按钮数组
 *
 * @example
 * replaceScriptButtons([{name: '开始游戏', visible: true}])
 *
 * @example
 * eventOnButton("前往地点" () => {
 *   replaceScriptButtons([{name: '学校', visible: true}, {name: '商店', visible: true}])
 * })
 */
declare function replaceScriptButtons(buttons: ScriptButton[]): void;

/**
 * 为脚本按钮列表末尾添加不存在的按钮, 不会重复添加同名按钮, **只能在脚本中使用**
 *
 * @param buttons
 *
 * @example
 * appendInexistentScriptButtons([{name: '重新开始', visible: true}]);
 */
declare function appendInexistentScriptButtons(buttons: ScriptButton[]): void;

/** 获取脚本作者注释 */
declare function getScriptInfo(): string;

/**
 * 替换脚本作者注释
 *
 * @param info 新的作者注释
 */
declare function replaceScriptInfo(info: string): void;

/**
 * 在前端界面或脚本内使用, 从而重新加载前端界面或脚本
 *
 * 这相当于调用 `window.location.reload()`, 会让分享到全局的接口失效;
 *   如果有需要在重新加载前端界面后沿用的数据, 你应该自行编写重新加载方式而不是使用这个函数
 *
 * @example
 * let current_chat_id = SillyTavern.getCurrentChatId();
 * eventOn(tavern_events.CHAT_CHANGED, chat_id => {
 *   if (current_chat_id !== chat_id) {
 *     current_chat_id = chat_id;
 *     reloadIframe();
 *   }
 * })
 *
 * @example
 * function initailzie() { ... }
 * $(initialize);
 *
 * function destroy() { eventClearAll(); ... }
 * $(window).on('pagehide', destroy);
 *
 * function reload() {
 *   destory();
 *   initialize();
 * }
 */
declare function reloadIframe(): void;

/**
 * 获取前端界面或脚本的标识名称
 *
 * @returns 对于前端界面是 `TH-message--楼层号--前端界面是该楼层第几个界面`, 对于脚本库是 `TH-script--脚本名称--脚本id`
 */
declare function getIframeName(): string;

/**
 * 获取本消息楼层 iframe 所在楼层的楼层 id, **只能对楼层消息 iframe** 使用
 *
 * @returns 楼层 id
 *
 * @throws 如果不在楼层消息 iframe 内使用, 将会抛出错误
 */
declare function getCurrentMessageId(): number;

/**
 * 获取脚本的脚本库 id, **只能在脚本内使用**
 *
 * @returns 脚本库的 id
 *
 * @throws 如果不在脚本内使用, 将会抛出错误
 */
declare function getScriptId(): string;

/**
 * 获取合并后的变量表
 * - 如果在消息楼层 iframe 中调用本函数, 则获取 全局→角色卡→聊天→0号消息楼层→中间所有消息楼层→当前消息楼层 的合并结果
 * - 如果在全局变量 iframe 中调用本函数, 则获取 全局→角色卡→脚本→聊天→0号消息楼层→中间所有消息楼层→最新消息楼层 的合并结果
 *
 * @example
 * const variables = getAllVariables();
 */
declare function getAllVariables(): Record<string, any>;
