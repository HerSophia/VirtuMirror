<script setup lang="ts">
/**
 * Markdown 渲染组件
 * 使用 marked 库将 Markdown 文本渲染为 HTML
 */
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  /** Markdown 内容 */
  content: string
  /** 是否启用换行符转换 */
  breaks?: boolean
  /** 是否使用 GitHub 风格的 Markdown */
  gfm?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  breaks: true,
  gfm: true
})

// 配置 marked
marked.setOptions({
  breaks: props.breaks,
  gfm: props.gfm
})

// 将 Markdown 转换为 HTML
const renderedHtml = computed(() => {
  if (!props.content) return ''
  return marked(props.content) as string
})
</script>

<template>
  <div class="markdown-renderer" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-renderer {
  @apply text-base leading-relaxed;
  color: var(--color-text);
}

/* 标题样式 */
.markdown-renderer :deep(h1) {
  @apply text-2xl font-bold mt-6 mb-4;
  color: var(--color-text);
}

.markdown-renderer :deep(h2) {
  @apply text-xl font-bold mt-5 mb-3;
  color: var(--color-text);
}

.markdown-renderer :deep(h3) {
  @apply text-lg font-semibold mt-4 mb-2;
  color: var(--color-text);
}

.markdown-renderer :deep(h4),
.markdown-renderer :deep(h5),
.markdown-renderer :deep(h6) {
  @apply text-base font-semibold mt-3 mb-2;
  color: var(--color-text);
}

/* 段落和文本 */
.markdown-renderer :deep(p) {
  @apply my-3 leading-relaxed;
}

.markdown-renderer :deep(strong) {
  @apply font-bold;
}

.markdown-renderer :deep(em) {
  @apply italic;
}

/* 链接 */
.markdown-renderer :deep(a) {
  color: var(--color-primary);
  @apply underline;
}

.markdown-renderer :deep(a:hover) {
  @apply opacity-80;
}

/* 列表 */
.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  @apply my-3 pl-6;
}

.markdown-renderer :deep(ul) {
  @apply list-disc;
}

.markdown-renderer :deep(ol) {
  @apply list-decimal;
}

.markdown-renderer :deep(li) {
  @apply my-1;
}

/* 代码块 */
.markdown-renderer :deep(code) {
  @apply px-1.5 py-0.5 rounded text-sm font-mono;
  background: var(--color-surface-variant);
}

.markdown-renderer :deep(pre) {
  @apply my-4 p-4 rounded-lg overflow-x-auto;
  background: var(--color-surface-variant);
}

.markdown-renderer :deep(pre code) {
  @apply p-0 bg-transparent;
}

/* 引用 */
.markdown-renderer :deep(blockquote) {
  @apply my-4 pl-4 italic;
  border-left: 4px solid var(--color-primary);
  color: var(--color-text-secondary);
}

/* 水平线 */
.markdown-renderer :deep(hr) {
  @apply my-6 border-0 h-px;
  background: var(--color-border);
}

/* 表格 */
.markdown-renderer :deep(table) {
  @apply w-full my-4 border-collapse;
}

.markdown-renderer :deep(th),
.markdown-renderer :deep(td) {
  @apply px-3 py-2 text-left;
  border: 1px solid var(--color-border);
}

.markdown-renderer :deep(th) {
  @apply font-semibold;
  background: var(--color-surface-variant);
}

.markdown-renderer :deep(tr:nth-child(even)) {
  background: var(--color-surface);
}

/* 图片 */
.markdown-renderer :deep(img) {
  @apply max-w-full h-auto rounded-lg my-4;
}

/* 复选框（任务列表） */
.markdown-renderer :deep(input[type="checkbox"]) {
  @apply mr-2;
}
</style>