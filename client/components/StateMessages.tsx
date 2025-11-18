export function LoadingState ({ message = 'Loading...'}: { message?: string}) {
  return <p className="text-gray-600">{message}</p>
}

export function ErrorState({ message } : { message: string}) {
  return <p className="text-red-600">{message}</p>
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-gray-600">{message}</p>
}