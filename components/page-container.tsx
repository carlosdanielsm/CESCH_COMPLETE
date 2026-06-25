import type React from "react"
interface PageContainerProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
}

export function PageContainer({ children, actions }: PageContainerProps) {
  return (
    <div className="flex h-full flex-col">
      {actions && (
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center justify-end gap-2">{actions}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  )
}
