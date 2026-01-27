import { PromptService } from '@/services/prompt/promptService'
import type { PromptTemplate } from '@/types/prompts'

export function usePromptActions(refreshCallback?: () => void) {
  const handleToggle = (prompt: PromptTemplate) => {
    PromptService.togglePrompt(prompt.id)
    refreshCallback?.()
  }

  const handleReset = (id: string) => {
    if (confirm('确定要重置此提示词为默认值吗？')) {
      PromptService.resetPrompt(id)
      refreshCallback?.()
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('确定要删除此提示词吗？')) {
      PromptService.deletePrompt(id)
      refreshCallback?.()
    }
  }

  const handleDuplicate = (id: string) => {
    PromptService.duplicatePrompt(id)
    refreshCallback?.()
  }

  const handleExport = () => {
    const json = PromptService.exportConfig()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `phone-prompts-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    return new Promise<boolean>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          try {
            const text = await file.text()
            const success = PromptService.importConfig(text)
            if (success) {
              refreshCallback?.()
              resolve(true)
            } else {
              resolve(false)
            }
          } catch (err) {
            console.error(err)
            resolve(false)
          }
        } else {
          resolve(false)
        }
      }
      input.click()
    })
  }

  return {
    handleToggle,
    handleReset,
    handleDelete,
    handleDuplicate,
    handleExport,
    handleImport,
  }
}
