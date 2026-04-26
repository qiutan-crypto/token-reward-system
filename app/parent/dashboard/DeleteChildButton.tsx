'use client'

export default function DeleteChildButton({
  childId,
  childName,
  action,
}: {
  childId: string
  childName: string
  action: (id: string) => Promise<void>
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        if (confirm(`确定删除 ${childName}？`)) {
          await action(childId)
        }
      }}
      className="px-3 py-2 text-gray-300 hover:text-red-500 text-sm transition-colors"
    >
      🗑
    </button>
  )
}
