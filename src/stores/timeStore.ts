import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { timeService, type TimeMode } from '@/services/timeService'

export const useTimeStore = defineStore('time', () => {
  // Reactive state mirroring service
  const currentTime = ref(timeService.getCurrentTime())
  const mode = ref<TimeMode>(timeService.mode.value)
  const is24Hour = ref(timeService.is24Hour.value)
  
  // Listen to service updates
  timeService.addTickListener((date) => {
    currentTime.value = date
  })
  
  // Actions
  function setMode(newMode: TimeMode) {
    // Update local state, watcher will update service
    mode.value = newMode
  }
  
  function set24Hour(value: boolean) {
    // Update local state, watcher will update service
    is24Hour.value = value
  }
  
  function formatTime(date: Date, options?: { includeSeconds?: boolean }) {
    return timeService.formatTime(date, options)
  }

  // Sync from store to service (handles hydration and UI changes)
  watch(mode, (newMode) => {
    if (timeService.mode.value !== newMode) {
      timeService.setMode(newMode)
    }
  })

  watch(is24Hour, (newVal) => {
    if (timeService.is24Hour.value !== newVal) {
      timeService.set24Hour(newVal)
    }
  })

  // Initial sync (in case service has different defaults or store was hydrated)
  if (timeService.mode.value !== mode.value) timeService.setMode(mode.value)
  if (timeService.is24Hour.value !== is24Hour.value) timeService.set24Hour(is24Hour.value)

  return {
    currentTime,
    mode,
    is24Hour,
    setMode,
    set24Hour,
    formatTime
  }
}, {
  persist: {
    key: 'phone-sim-time-settings',
    paths: ['mode', 'is24Hour']
  }
})
