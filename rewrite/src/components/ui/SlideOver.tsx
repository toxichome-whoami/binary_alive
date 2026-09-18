import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'w-[460px] max-w-full',
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

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 sm:inset-y-2.5 right-0 flex max-w-full pl-0 sm:pl-10 pointer-events-none">
        {/* Outer Container (Matching Table outer black frame) */}
        <div
          className={cn(
            'w-screen pointer-events-auto bg-black border-l border-y border-[#222222] rounded-tl-2xl rounded-bl-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 ease-out select-text overflow-hidden',
            width
          )}
        >
          {/* Outer Header Bar (Title & metadata on pure black frame) */}
          <div className="flex items-center justify-between px-4 py-3 bg-black shrink-0">
            <div className="min-w-0 pr-2">
              <h2 className="text-[15px] font-semibold text-white tracking-tight truncate" title={title}>{title}</h2>
              {subtitle && <div className="mt-0.5">{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-[#8c8c8c] hover:text-white rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer shrink-0 ml-2"
              title="Close (Esc)"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 256 256"
                fill="currentColor"
              >
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>
          </div>

          {/* Inset Container ("container in container" like table and calendar) */}
          <div className="mx-[6px] mb-[6px] flex-1 flex flex-col border border-[#262626] rounded-tl-xl rounded-bl-xl rounded-tr-md rounded-br-md bg-[#0e0e0e] overflow-hidden min-h-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
