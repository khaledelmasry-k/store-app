import { useContext } from 'preact/hooks'
import { ThemeContext } from '../contexts/theme-context'

export function useTheme() {
  return useContext(ThemeContext)
}
