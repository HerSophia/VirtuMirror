/**
 * SillyTavern 提供给插件的稳定接口
 * 具体内容见于 SillyTavern/public/scripts/st-context.js
 */

declare namespace SillyTavern {
  type ChatMessage = {
    name: string;
    is_user: boolean;
    is_system: boolean;
    mes: string;
    swipe_id?: number;
    swipes?: string[];
    swipe_info?: Record<string, any>[];
    extra?: Record<string, any>;
    variables?: Record<string, any>[] | { [swipe_id: number]: Record<string, any> };
  };

  type SendingMessage = {
    role: 'user' | 'assistant' | 'system';
    content:
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } }
          | { type: 'video_url'; video_url: { url: string } }
        >;
  };

  type FlattenedWorldInfoEntry = {
    uid: number;
    displayIndex: number;
    comment?: string;
    disable: boolean;
    constant: boolean;
    selective: boolean;
    key: string[];
    selectiveLogic: 0 | 1 | 2 | 3;
    keysecondary: string[];
    scanDepth: number | null;
    vectorized: boolean;
    position: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    role: 0 | 1 | 2 | null;
    depth: number;
    order: number;
    content: string;
    useProbability: boolean;
    probability: number;
    excludeRecursion: boolean;
    preventRecursion: boolean;
    delayUntilRecursion: boolean | number;
    sticky: number | null;
    cooldown: number | null;
    delay: number | null;
    extra?: Record<string, any>;
  };

  type v1CharData = {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creatorcomment: string;
    tags: string[];
    talkativeness: number;
    fav: boolean | string;
    create_date: string;
    data: v2CharData;
    chat: string;
    avatar: string;
    json_data: string;
    shallow?: boolean;
  };

  type v2CharData = {
    name: string;
    description: string;
    character_version: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    tags: string[];
    system_prompt: string;
    post_history_instructions: string;
    creator: string;
    alternate_greetings: string[];
    character_book: v2WorldInfoBook;
    extensions: v2CharDataExtensionInfos;
  };

  type v2WorldInfoBook = {
    name: string;
    entries: v2DataWorldInfoEntry[];
  };

  type v2DataWorldInfoEntry = {
    keys: string[];
    secondary_keys: string[];
    comment: string;
    content: string;
    constant: boolean;
    selective: boolean;
    insertion_order: number;
    enabled: boolean;
    position: string;
    extensions: v2DataWorldInfoEntryExtensionInfos;
    id: number;
  };

  type v2DataWorldInfoEntryExtensionInfos = {
    position: number;
    exclude_recursion: boolean;
    probability: number;
    useProbability: boolean;
    depth: number;
    selectiveLogic: number;
    group: string;
    group_override: boolean;
    group_weight: number;
    prevent_recursion: boolean;
    delay_until_recursion: boolean;
    scan_depth: number;
    match_whole_words: boolean;
    use_group_scoring: boolean;
    case_sensitive: boolean;
    automation_id: string;
    role: number;
    vectorized: boolean;
    display_index: number;
    match_persona_description: boolean;
    match_character_description: boolean;
    match_character_personality: boolean;
    match_character_depth_prompt: boolean;
    match_scenario: boolean;
    match_creator_notes: boolean;
  };

  type v2CharDataExtensionInfos = {
    talkativeness: number;
    fav: boolean;
    world: string;
    depth_prompt: {
      depth: number;
      prompt: string;
      role: 'system' | 'user' | 'assistant';
    };
    regex_scripts: RegexScriptData[];
    pygmalion_id?: string;
    github_repo?: string;
    source_url?: string;
    chub?: { full_path: string };
    risuai?: { source: string[] };
    sd_character_prompt?: { positive: string; negative: string };
  };

  type RegexScriptData = {
    id: string;
    scriptName: string;
    findRegex: string;
    replaceString: string;
    trimStrings: string[];
    placement: number[];
    disabled: boolean;
    markdownOnly: boolean;
    promptOnly: boolean;
    runOnEdit: boolean;
    substituteRegex: number;
    minDepth: number;
    maxDepth: number;
  };

  type PopupOptions = {
    okButton?: string | boolean;
    cancelButton?: string | boolean;
    rows?: number;
    wide?: boolean;
    wider?: boolean;
    large?: boolean;
    transparent?: boolean;
    allowHorizontalScrolling?: boolean;
    allowVerticalScrolling?: boolean;
    leftAlign?: boolean;
    animation?: 'slow' | 'fast' | 'none';
    defaultResult?: number;
    customButtons?: CustomPopupButton[] | string[];
    customInputs?: CustomPopupInput[];
    onClosing?: (popup: InstanceType<typeof SillyTavern.Popup>) => Promise<boolean | void>;
    onClose?: (popup: InstanceType<typeof SillyTavern.Popup>) => Promise<void>;
    onOpen?: (popup: InstanceType<typeof SillyTavern.Popup>) => Promise<void>;
    cropAspect?: number;
    cropImage?: string;
  };

  type CustomPopupButton = {
    text: string;
    result?: number;
    classes?: string[] | string;
    action?: () => void;
    appendAtEnd?: boolean;
  };

  type CustomPopupInput = {
    id: string;
    label: string;
    tooltip?: string;
    defaultState?: boolean;
    type?: string;
  };
}

declare const SillyTavern: {
  readonly accountStorage: any;
  readonly chat: Array<SillyTavern.ChatMessage>;
  readonly characters: SillyTavern.v1CharData[];
  readonly groups: any;
  readonly name1: string;
  readonly name2: string;
  readonly characterId: string;
  readonly groupId: string;
  readonly chatId: string;
  readonly getCurrentChatId: () => string;
  readonly getRequestHeaders: () => { 'Content-Type': string; 'X-CSRF-TOKEN': string };
  readonly reloadCurrentChat: () => Promise<void>;
  readonly renameChat: (old_name: string, new_name: string) => Promise<void>;
  readonly saveSettingsDebounced: () => Promise<void>;
  readonly onlineStatus: string;
  readonly maxContext: number;
  readonly chatMetadata: Record<string, any>;
  readonly streamingProcessor: any;
  readonly eventSource: {
    on: typeof eventOn;
    makeLast: typeof eventMakeLast;
    makeFirst: typeof eventMakeFirst;
    removeListener: typeof eventRemoveListener;
    emit: typeof eventEmit;
    emitAndWait: typeof eventEmitAndWait;
    once: typeof eventOnce;
  };
  readonly eventTypes: typeof tavern_events;
  readonly addOneMessage: (mes: object, options: any) => Promise<void>;
  readonly deleteLastMessage: () => Promise<void>;
  readonly generate: Function;
  readonly sendStreamingRequest: (type: string, data: object) => Promise<void>;
  readonly sendGenerationRequest: (type: string, data: object) => Promise<void>;
  readonly stopGeneration: () => boolean;
  readonly tokenizers: any;
  readonly getTextTokens: (tokenizer_type: number, str: string) => Promise<number>;
  readonly getTokenCountAsync: (str: string, padding?: number) => Promise<number>;
  readonly extensionPrompts: Record<string, { value: string; position: number; depth: number; scan: boolean; role: number; filter: () => Promise<boolean> | boolean }>;
  readonly setExtensionPrompt: (prompt_id: string, content: string, position: -1 | 1, depth: number, scan?: boolean, role?: number, filter?: () => Promise<boolean> | boolean) => Promise<void>;
  readonly updateChatMetadata: (new_values: any, reset: boolean) => void;
  readonly saveChat: () => Promise<void>;
  readonly openCharacterChat: (file_name: any) => Promise<void>;
  readonly openGroupChat: (group_id: any, chat_id: any) => Promise<void>;
  readonly saveMetadata: () => Promise<void>;
  readonly sendSystemMessage: (type: any, text: any, extra?: any) => Promise<void>;
  readonly activateSendButtons: () => void;
  readonly deactivateSendButtons: () => void;
  readonly saveReply: (options: any, ...args: any[]) => Promise<void>;
  readonly substituteParams: (content: string, name1?: string, name2?: string, original?: string, group?: string, replace_character_card?: boolean, additional_macro?: Record<string, any>, post_process_function?: (text: string) => string) => Promise<void>;
  readonly substituteParamsExtended: (content: string, additional_macro?: Record<string, any>, post_process_function?: (text: string) => string) => Promise<void>;
  readonly SlashCommandParser: any;
  readonly SlashCommand: any;
  readonly SlashCommandArgument: any;
  readonly SlashCommandNamedArgument: any;
  readonly ARGUMENT_TYPE: { STRING: string; NUMBER: string; RANGE: string; BOOLEAN: string; VARIABLE_NAME: string; CLOSURE: string; SUBCOMMAND: string; LIST: string; DICTIONARY: string };
  readonly executeSlashCommandsWithOptions: (text: string, options?: any) => Promise<{ interrupt: boolean; pipe: string; isBreak: boolean; isAborted: boolean; isQuietlyAborted: boolean; abortReason: string; isError: boolean; errorMessage: string }>;
  readonly timestampToMoment: (timestamp: string | number) => any;
  readonly registerMacro: (key: string, value: string | ((uid: string) => string), description?: string) => void;
  readonly unregisterMacro: (key: string) => void;
  readonly registerFunctionTool: (tool: { name: string; displayName: string; description: string; parameters: Record<string, any>; action: ((args: any) => string) | ((args: any) => Promise<string>); formatMessage?: (args: any) => string; shouldRegister?: (() => boolean) | (() => Promise<boolean>); stealth?: boolean }) => void;
  readonly unregisterFunctionTool: (name: string) => void;
  readonly isToolCallingSupported: () => boolean;
  readonly canPerformToolCalls: (type: string) => boolean;
  readonly ToolManager: any;
  readonly registerDebugFunction: (function_id: string, name: string, description: string, fn: Function) => void;
  readonly renderExtensionTemplateAsync: (extension_name: string, template_id: string, template_data?: object, sanitize?: boolean, localize?: boolean) => Promise<string>;
  readonly registerDataBankScraper: (scraper: any) => Promise<void>;
  readonly showLoader: () => void;
  readonly hideLoader: () => Promise<any>;
  readonly mainApi: any;
  readonly extensionSettings: Record<string, any>;
  readonly ModuleWorkerWrapper: any;
  readonly getTokenizerModel: () => string;
  readonly generateQuietPrompt: () => (quiet_prompt: string, quiet_to_loud: boolean, skip_wian: boolean, quiet_image?: string, quiet_name?: string, response_length?: number, force_chid?: number) => Promise<string>;
  readonly writeExtensionField: (character_id: number, key: string, value: any) => Promise<void>;
  readonly getThumbnailUrl: (type: any, file: any) => string;
  readonly selectCharacterById: (id: number, options?: { switchMenu?: boolean }) => Promise<void>;
  readonly messageFormatting: (message: string, ch_name: string, is_system: boolean, is_user: boolean, message_id: number, sanitizerOverrides?: object, isReasoning?: boolean) => string;
  readonly shouldSendOnEnter: () => boolean;
  readonly isMobile: () => boolean;
  readonly t: (strings: string, ...values: any[]) => string;
  readonly translate: (text: string, key?: string | null) => string;
  readonly getCurrentLocale: () => string;
  readonly addLocaleData: (localeId: string, data: Record<string, string>) => void;
  readonly tags: any[];
  readonly tagMap: { [identifier: string]: string[] };
  readonly menuType: any;
  readonly createCharacterData: Record<string, any>;
  readonly Popup: { new (content: JQuery<HTMLElement> | string | Element, type: number, inputValue?: string, popupOptions?: SillyTavern.PopupOptions): { dlg: HTMLDialogElement; show: () => Promise<void>; complete: (result: number) => Promise<void>; completeAffirmative: () => Promise<void>; completeNegative: () => Promise<void>; completeCancelled: () => Promise<void> } };
  readonly POPUP_TYPE: { TEXT: number; CONFIRM: number; INPUT: number; DISPLAY: number; CROP: number };
  readonly POPUP_RESULT: { AFFIRMATIVE: number; NEGATIVE: number; CANCELLED: number; CUSTOM1: number; CUSTOM2: number; CUSTOM3: number; CUSTOM4: number; CUSTOM5: number; CUSTOM6: number; CUSTOM7: number; CUSTOM8: number; CUSTOM9: number };
  readonly callGenericPopup: (content: JQuery<HTMLElement> | string | Element, type: number, inputValue?: string, popupOptions?: SillyTavern.PopupOptions) => Promise<number | string | boolean | undefined>;
  readonly chatCompletionSettings: any;
  readonly textCompletionSettings: any;
  readonly powerUserSettings: any;
  readonly getCharacters: () => Promise<void>;
  readonly getCharacterCardFields: (options?: { chid?: number }) => any;
  readonly uuidv4: () => string;
  readonly humanizedDateTime: () => string;
  readonly updateMessageBlock: (message_id: number, message: object, options?: { rerenderMessage?: boolean }) => void;
  readonly appendMediaToMessage: (mes: object, messageElement: JQuery<HTMLElement>, adjust_scroll?: boolean) => void;
  readonly loadWorldInfo: (name: string) => Promise<any | null>;
  readonly saveWorldInfo: (name: string, data: any, immediately?: boolean) => Promise<void>;
  readonly reloadWorldInfoEditor: (file: string, loadIfNotSelected?: boolean) => void;
  readonly updateWorldInfoList: () => Promise<void>;
  readonly convertCharacterBook: (character_book: any) => { entries: Record<string, any>; originalData: Record<string, any> };
  readonly getWorldInfoPrompt: (chat: string[], max_context: number, is_dry_run: boolean) => Promise<{ worldInfoString: string; worldInfoBefore: string; worldInfoAfter: string; worldInfoExamples: any[]; worldInfoDepth: any[]; anBefore: any[]; anAfter: any[] }>;
  readonly CONNECT_API_MAP: Record<string, any>;
  readonly getTextGenServer: (type?: string) => string;
  readonly extractMessageFromData: (data: object, activateApi?: string) => string;
  readonly getPresetManager: (apiId?: string) => any;
  readonly getChatCompletionModel: (source?: string) => string;
  readonly printMessages: () => Promise<void>;
  readonly clearChat: () => Promise<void>;
  readonly ChatCompletionService: any;
  readonly TextCompletionService: any;
  readonly ConnectionManagerRequestService: any;
  readonly updateReasoningUI: (message_id_or_element: number | JQuery<HTMLElement> | HTMLElement, options?: { reset?: boolean }) => void;
  readonly parseReasoningFromString: (str: string, options?: { strict?: boolean }) => any | null;
  readonly unshallowCharacter: (character_id?: string) => Promise<void>;
  readonly unshallowGroupMembers: (group_id: string) => Promise<void>;
  readonly symbols: { ignore: any };
};