import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-lg bg-[#0e0e0e] border border-[#262626] rounded-lg overflow-hidden z-10 animate-in zoom-in-95 duration-150',
          className
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 bg-transparent">
          <h3 className="text-[18px] font-medium text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#a1a1a1] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer -mr-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2 text-[14px]">{children}</div>
      </div>
    </div>
  );
};

