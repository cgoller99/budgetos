import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`
          w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5
          text-sm text-gray-900 placeholder:text-gray-400
          transition-all duration-200 ease-out
          focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10
          ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 animate-fade-in">
          {error}
        </p>
      )}
    </div>
  )
}
