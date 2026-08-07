"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import Image from "next/image"

interface DynamicLogoProps {
  width?: number
  height?: number
  className?: string
}

export function DynamicLogo({ width = 80, height = 80, className }: DynamicLogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ width, height }} className={className} />
  }

  const currentTheme = theme === 'system' ? resolvedTheme : theme
  const src = currentTheme === 'dark' ? '/EscudoSedCaucaB.png' : '/EscudoSedCauca.png'

  return (
    <Image
      src={src}
      alt="Escudo SED Cauca"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}