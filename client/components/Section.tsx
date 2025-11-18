import { ReactNode } from "react"

interface SectionProps {
  title: string
  children: ReactNode
}

export default function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      {children}
    </div>
  )
}