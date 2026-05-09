import { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function Button({
  children,
  variant = 'primary',
  ...props
}: Props) {
  const variants = {
    primary: 'bg-black text-white hover:opacity-90',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  }

  return (
    <button
      {...props}
      className={`rounded-2xl px-5 py-3 font-medium transition-all ${variants[variant]}`}
    >
      {children}
    </button>
  )
}