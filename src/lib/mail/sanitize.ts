import DOMPurify from 'dompurify';

export interface SanitizeMailOptions {
  allowRemoteImages?: boolean;
}

export interface SanitizedMail {
  html: string;
  blockedRemoteImages: number;
}

const FORBID_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'video',
  'audio',
  'source',
  'track',
];

const FORBID_ATTR = [
  'srcset',
  'background',
  'formaction',
  'ping',
  'xlink:href',
  'action',
  'method',
  'http-equiv',
];

function isRemoteUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith('//')) return true;
  if (/^https?:/i.test(trimmed)) return true;
  return false;
}

/**
 * Sanitize message HTML for rendering inside a sandboxed iframe.
 * Remote images stay blocked unless explicitly allowed for the current sender,
 * and any inline style that would fetch a remote resource is stripped.
 */
export function sanitizeMailHtml(
  input: string,
  options: SanitizeMailOptions = {},
): SanitizedMail {
  if (!input) return { html: '', blockedRemoteImages: 0 };
  const clean = DOMPurify.sanitize(input, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ['target', 'rel'],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
  });

  const template = document.createElement('template');
  template.innerHTML = clean;
  let blockedRemoteImages = 0;

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    const style = element.getAttribute('style');
    if (style && /url\s*\(/i.test(style)) {
      element.removeAttribute('style');
      if (/url\s*\(\s*['"]?(?:https?:)?\/\//i.test(style)) blockedRemoteImages += 1;
    }
    const linkTarget = element.getAttribute('href');
    if (element.tagName === 'A' && linkTarget) {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
      if (/^(javascript|data|vbscript):/i.test(linkTarget.trim())) {
        element.removeAttribute('href');
      }
    }
    if (element.tagName === 'IMG') {
      const source = element.getAttribute('src') ?? element.getAttribute('data-src') ?? '';
      if (!source) {
        element.remove();
        continue;
      }
      if (isRemoteUrl(source)) {
        if (options.allowRemoteImages) {
          element.setAttribute('src', source);
          element.removeAttribute('data-blocked-src');
        } else {
          blockedRemoteImages += 1;
          element.removeAttribute('src');
          element.setAttribute('data-blocked-src', source);
          element.setAttribute('alt', element.getAttribute('alt') || '');
        }
      } else if (/^cid:/i.test(source)) {
        blockedRemoteImages += 1;
        element.remove();
      }
    }
  }

  return { html: template.innerHTML, blockedRemoteImages };
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0">${escaped}</pre>`;
}

export function createMailFrameDocument(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { padding: 20px; font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif; color: CanvasText; overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    img[data-blocked-src] { display: inline-block; min-width: 120px; min-height: 36px; border: 1px dashed GrayText; border-radius: 6px; background: Canvas; }
    a { color: LinkText; }
    table { max-width: 100%; border-collapse: collapse; }
    td, th { padding: 2px; }
    blockquote { margin: 0 0 0 0.75rem; padding-left: 0.75rem; border-left: 3px solid GrayText; color: GrayText; }
    pre { white-space: pre-wrap; word-break: break-word; }
    :focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
  </style></head><body>${bodyHtml}</body></html>`;
}
