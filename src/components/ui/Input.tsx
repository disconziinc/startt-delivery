import { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({
  label,
  ...props
}: Props) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none transition focus:border-black"
      />
    </div>
  )
}