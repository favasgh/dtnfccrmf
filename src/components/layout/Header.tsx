import Link from 'next/link'

export default function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between md:px-6">
      <h1 className="text-lg font-bold truncate text-foreground">{title}</h1>
      <div className="flex items-center gap-3">
        <Link
          href="/orders/new"
          className="text-xs bg-lime text-black font-semibold px-2.5 py-1 rounded-md hover:bg-lime-dark transition-colors"
        >
          + Order
        </Link>
      </div>
    </header>
  )
}
