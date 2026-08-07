"use client"

import * as React from "react"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Evitar errores de hidratación
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled />
  }

  // Determinamos el tema real (incluyendo si está en 'system')
  const currentTheme = theme === 'system' ? resolvedTheme : theme

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      title={currentTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="relative w-10 h-10"
    >
      {currentTheme === "dark" ? (
        <Sun className="h-[1.2rem] w-[1.2rem] transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] transition-all" />
      )}
      <span className="sr-only">Alternar tema</span>
    </Button>
  )
}
