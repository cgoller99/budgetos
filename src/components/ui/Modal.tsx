import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="
        fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none
        bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm
        open:animate-modal-backdrop
      "
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose()
        }
      }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="
            w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-black/10
            open:animate-modal-content
          "
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </dialog>
  )
}
