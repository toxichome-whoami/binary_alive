import { Dialog } from '../ui/Dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4 font-sans">
        <p className="text-[14px] text-[#a1a1a1] leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-[14px] font-medium text-[#cccccc] hover:text-white bg-transparent border border-[#262626] hover:border-[#383838] hover:bg-[#161616] transition-colors cursor-pointer"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          
          {variant === 'danger' ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden ring-1 ring-[#991b1b] bg-[#dc2626]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#ef4444] to-[#dc2626] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
              <span className="relative flex items-center gap-1.5 text-[14px]">
                {isLoading ? 'Processing...' : confirmLabel}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className="group relative flex shrink-0 items-center justify-center h-9 px-4 rounded-[8px] font-medium text-white shadow-xs outline-none cursor-pointer disabled:opacity-50 overflow-hidden ring-1 ring-[#1d4ed8] bg-[#2563eb]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black opacity-0 group-hover:opacity-15 transition-opacity duration-200" />
              <span className="relative flex items-center gap-1.5 text-[14px]">
                {isLoading ? 'Processing...' : confirmLabel}
              </span>
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
};
