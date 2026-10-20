import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useToastStore } from './toast';

export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="toast-stack pointer-events-auto fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-1.5"
    >
      {toasts
        .slice()
        .reverse()
        .map((item, index) => (
          <div
            key={item.id}
            role={item.variant === 'destructive' ? 'alert' : 'status'}
            className={cn(
              'rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-lg',
              index > 0 && 'toast-extra',
              item.variant === 'destructive' && 'border-destructive/40',
              item.variant === 'success' && 'border-task-sync/40',
            )}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="toast-title line-clamp-1 text-[13px] font-medium">
                  {item.title}
                </p>
                {item.description ? (
                  <div className="toast-desc grid">
                    <p className="min-h-0 overflow-hidden text-[11px] text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
