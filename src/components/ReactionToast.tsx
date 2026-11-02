import React from 'react';
import { X, Heart, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ReactionToast: React.FC = () => {
  const { activeNotification, dismissNotification } = useApp();

  if (!activeNotification) return null;

  return (
    <div className="fixed top-20 right-4 z-50 max-w-sm w-[90vw]">
      <div className="p-4 rounded-2xl bg-white/95 dark:bg-stone-900/95 border border-amber-200 dark:border-amber-900/50 shadow-xl flex items-center justify-between gap-3 text-stone-800 dark:text-stone-100">
        <div className="flex items-center gap-3">
          <span className="text-3xl shrink-0 animate-bounce">
            {activeNotification.emoji}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {activeNotification.senderName}
              </span>
              <span className="text-[11px] text-stone-500">menyemangatimu!</span>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 font-medium line-clamp-2">
              {activeNotification.message}
            </p>
          </div>
        </div>

        <button type="button"
          onClick={dismissNotification}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
