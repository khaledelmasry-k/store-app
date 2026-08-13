import { FunctionalComponent } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { ThemeContext } from './theme-context'

const KEY = 'mk-theme'

export const ThemeProvider: FunctionalComponent = ({ children }) => {
  // The site defaults to LIGHT mode. The OS `prefers-color-scheme` is NEVER
  // used on first visit — only an explicit user choice (saved in localStorage)
  // overrides the default, so a fresh browser / new store always starts light.
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  const setTheme = (t: 'light' | 'dark') => setThemeState(t)
  const toggle = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'))

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}
