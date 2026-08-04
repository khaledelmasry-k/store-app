import { createContext } from 'preact'

export interface ThemeState {
  theme: 'light' | 'dark'
  toggle: () => void
  setTheme: (t: 'light' | 'dark') => void
}

export const ThemeContext = createContext<ThemeState>({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
})
