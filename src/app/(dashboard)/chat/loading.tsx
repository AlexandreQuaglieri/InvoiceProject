// Skeleton du chat : quelques bulles de conversation + barre de saisie.
import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <div className="flex-1 space-y-4 pt-4">
        <Skeleton className="h-12 w-2/3 rounded-lg" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
        <Skeleton className="h-16 w-3/4 rounded-lg" />
        <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  )
}
