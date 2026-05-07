import { type ReactNode } from 'react'
import { Navigation } from './Navigation'

interface LayoutProps {
  children: ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export function Layout({ children, title, showBack, onBack }: LayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 h-12 flex items-center gap-3">
        {showBack && (
          <button onClick={onBack} className="text-mesh-400 hover:text-mesh-300">
            ←
          </button>
        )}
        <h1 className="text-sm font-semibold tracking-wide uppercase text-slate-300">
          {title || 'BitChat AI-Mesh'}
        </h1>
      </header>

      <main className="flex-1 pt-12 pb-20 px-4 overflow-y-auto">
        {children}
      </main>

      <Navigation />
    </div>
  )
}
