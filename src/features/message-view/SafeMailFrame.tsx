import { useEffect, useMemo } from 'react';
import { createMailFrameDocument, sanitizeMailHtml, textToHtml } from '@/lib/mail/sanitize';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

export function SafeMailFrame({
  html,
  text,
  title,
  allowRemoteImages = false,
  cidImages,
  className,
  onBlockedImages,
}: {
  html?: string;
  text?: string;
  title: string;
  allowRemoteImages?: boolean;
  cidImages?: Record<string, string>;
  className?: string;
  onBlockedImages?: (count: number) => void;
}) {
  const dark = useResolvedTheme() === 'dark';
  const sanitized = useMemo(() => {
    const source = html && html.trim() !== '' ? html : textToHtml(text ?? '');
    return sanitizeMailHtml(source, { allowRemoteImages, cidImages, dark });
  }, [allowRemoteImages, cidImages, dark, html, text]);

  useEffect(() => {
    onBlockedImages?.(sanitized.blockedRemoteImages);
  }, [onBlockedImages, sanitized.blockedRemoteImages]);

  const documentHtml = useMemo(
    () => createMailFrameDocument(sanitized.html, dark),
    [dark, sanitized.html],
  );

  return (
    <iframe
      title={title}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={documentHtml}
      className={className}
      style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
    />
  );
}
