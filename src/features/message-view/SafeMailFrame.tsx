import { useEffect, useMemo } from 'react';
import { createMailFrameDocument, sanitizeMailHtml, textToHtml } from '@/lib/mail/sanitize';

export function SafeMailFrame({
  html,
  text,
  title,
  allowRemoteImages = false,
  className,
  onBlockedImages,
}: {
  html?: string;
  text?: string;
  title: string;
  allowRemoteImages?: boolean;
  className?: string;
  onBlockedImages?: (count: number) => void;
}) {
  const sanitized = useMemo(() => {
    const source = html && html.trim() !== '' ? html : textToHtml(text ?? '');
    return sanitizeMailHtml(source, { allowRemoteImages });
  }, [allowRemoteImages, html, text]);

  useEffect(() => {
    onBlockedImages?.(sanitized.blockedRemoteImages);
  }, [onBlockedImages, sanitized.blockedRemoteImages]);

  const documentHtml = useMemo(
    () => createMailFrameDocument(sanitized.html),
    [sanitized.html],
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
