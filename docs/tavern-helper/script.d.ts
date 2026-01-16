/**
 * 脚本相关类型和函数
 * 用于获取脚本按钮信息
 */

/**
 * 获取所有处于启用状态的酒馆助手脚本按钮, 主要是方便 QR 助手等兼容脚本按钮
 */
declare function getAllEnabledScriptButtons(): { [script_id: string]: { button_id: string; button_name: string }[] };