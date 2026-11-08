import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'bank-dashboard-theme'

function readTheme() {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    root.style.backgroundColor = theme === 'dark' ? '#05070b' : '#f3f6fa'
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggleTheme }
}
