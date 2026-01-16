/**
 * 已废弃的世界书接口
 * 这些接口已被新的 worldbook 接口取代，请使用新接口
 */

/** @deprecated 请使用内置库 "世界书强制用推荐的全局设置" */
type LorebookSettings = {
  selected_global_lorebooks: string[];
  scan_depth: number;
  context_percentage: number;
  budget_cap: number;
  min_activations: number;
  max_depth: number;
  max_recursion_steps: number;
  insertion_strategy: 'evenly' | 'character_first' | 'global_first';
  include_names: boolean;
  recursive: boolean;
  case_sensitive: boolean;
  match_whole_words: boolean;
  use_group_scoring: boolean;
  overflow_alert: boolean;
}

/** @deprecated 请使用内置库 "世界书强制用推荐的全局设置" */
declare function getLorebookSettings(): LorebookSettings;
/** @deprecated 请使用内置库 "世界书强制用推荐的全局设置" */
declare function setLorebookSettings(settings: Partial<LorebookSettings>): void;

/** @deprecated 请使用 `getWorldbookNames` */
declare function getLorebooks(): string[];

/** @deprecated 请使用 `deleteWorldbook` */
declare function deleteLorebook(lorebook: string): Promise<boolean>;

/** @deprecated 请使用 `createWorldbook` */
declare function createLorebook(lorebook: string): Promise<boolean>;

/** @deprecated 请使用 `getCharWorldbookNames` */
type CharLorebooks = {
  primary: string | null;
  additional: string[];
}

/** @deprecated 请使用 `getCharWorldbookNames` */
type GetCharLorebooksOption = {
  name?: string;
  type?: 'all' | 'primary' | 'additional';
}

/** @deprecated 请使用 `getCharWorldbookNames` */
declare function getCharLorebooks({ name, type }?: GetCharLorebooksOption): CharLorebooks;

/** @deprecated 请使用 `getCharWorldbookNames` */
declare function getCurrentCharPrimaryLorebook(): string | null;

/** @deprecated 请使用 `rebindCharWorldbook` */
declare function setCurrentCharLorebooks(lorebooks: Partial<CharLorebooks>): Promise<void>;

/** @deprecated 请使用 `getChatWorldbook` */
declare function getChatLorebook(): string | null;

/** @deprecated 请使用 `rebindChatWorldbook` */
declare function setChatLorebook(lorebook: string | null): Promise<void>;

/** @deprecated 请使用 `getOrCreateChatWorldbook` */
declare function getOrCreateChatLorebook(lorebook?: string): Promise<string>;

/** @deprecated 请使用 `WolrdbookEntry` */
type LorebookEntry = {
  uid: number;
  display_index: number;
  comment: string;
  enabled: boolean;
  type: 'constant' | 'selective' | 'vectorized';
  position:
    | 'before_character_definition'
    | 'after_character_definition'
    | 'before_example_messages'
    | 'after_example_messages'
    | 'before_author_note'
    | 'after_author_note'
    | 'at_depth_as_system'
    | 'at_depth_as_assistant'
    | 'at_depth_as_user';
  depth: number | null;
  order: number;
  probability: number;
  keys: string[];
  logic: 'and_any' | 'and_all' | 'not_all' | 'not_any';
  filters: string[];
  scan_depth: 'same_as_global' | number;
  case_sensitive: 'same_as_global' | boolean;
  match_whole_words: 'same_as_global' | boolean;
  use_group_scoring: 'same_as_global' | boolean;
  automation_id: string | null;
  exclude_recursion: boolean;
  prevent_recursion: boolean;
  delay_until_recursion: boolean | number;
  content: string;
  group: string;
  group_prioritized: boolean;
  group_weight: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
};

/** @deprecated 请使用 `getWorldbook` */
type GetLorebookEntriesOption = {
  filter?: 'none' | Partial<LorebookEntry>;
};

/** @deprecated 请使用 `getWorldbook` */
declare function getLorebookEntries(lorebook: string): Promise<LorebookEntry[]>;

/** @deprecated 请使用 `replaceWorldbook` */
declare function replaceLorebookEntries(lorebook: string, entries: Partial<LorebookEntry>[]): Promise<void>;

/** @deprecated 请使用 `updateWorldbookWith` */
type LorebookEntriesUpdater =
  | ((entries: LorebookEntry[]) => Partial<LorebookEntry>[])
  | ((entries: LorebookEntry[]) => Promise<Partial<LorebookEntry>[]>);

/** @deprecated 请使用 `updateWorldbookWith` */
declare function updateLorebookEntriesWith(lorebook: string, updater: LorebookEntriesUpdater): Promise<LorebookEntry[]>;

/** @deprecated 请使用 `replaceWorldbook` */
declare function setLorebookEntries(
  lorebook: string,
  entries: Array<Pick<LorebookEntry, 'uid'> & Partial<LorebookEntry>>,
): Promise<LorebookEntry[]>;

/** @deprecated 请使用 `createWorldbookEntries` */
declare function createLorebookEntries(
  lorebook: string,
  entries: Partial<LorebookEntry>[],
): Promise<{ entries: LorebookEntry[]; new_uids: number[] }>;

/** @deprecated 请使用 `deleteWorldbookEntries` */
declare function deleteLorebookEntries(
  lorebook: string,
  uids: number[],
): Promise<{ entries: LorebookEntry[]; delete_occurred: boolean }>;