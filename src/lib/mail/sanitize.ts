import DOMPurify from 'dompurify';
import { darkenMailCss, darkenMailStyles } from './darkMode';

export interface SanitizeMailOptions {
  allowRemoteImages?: boolean;
  cidImages?: Record<string, string>;
  dark?: boolean;
}

// normalizeContentId strips angle brackets and percent encoding so that
// `cid:` URLs and MIME Content-ID headers compare reliably.
export function normalizeContentId(value: string): string {
  let id = value.trim();
  if (id.startsWith('<') && id.endsWith('>')) id = id.slice(1, -1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the raw value when it is not valid percent encoding.
  }
  return id.trim().toLowerCase();
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

function isTrackingPixel(element: Element): boolean {
  for (const name of ['width', 'height']) {
    const raw = element.getAttribute(name);
    if (raw === null) continue;
    const value = Number.parseInt(raw, 10);
    if (Number.isFinite(value) && value <= 2) return true;
  }
  const style = element.getAttribute('style') ?? '';
  const declarations = style.split(';');
  for (const declaration of declarations) {
    const [name, value] = declaration.split(':');
    if (!value) continue;
    if (!['width', 'height'].includes(name.trim().toLowerCase())) continue;
    const size = Number.parseInt(value, 10);
    if (Number.isFinite(size) && size <= 2) return true;
  }
  return false;
}

function isSmallImage(element: Element): boolean {
  let width: number | null = null;
  let height: number | null = null;
  for (const [name, target] of [
    ['width', 'width'],
    ['height', 'height'],
  ] as const) {
    const raw = element.getAttribute(name);
    if (raw !== null) {
      const value = Number.parseInt(raw, 10);
      if (Number.isFinite(value)) {
        if (target === 'width') width = value;
        else height = value;
      }
      continue;
    }
    const style = element.getAttribute('style') ?? '';
    for (const declaration of style.split(';')) {
      const [property, value] = declaration.split(':');
      if (!value || property.trim().toLowerCase() !== target) continue;
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        if (target === 'width') width = parsed;
        else height = parsed;
      }
    }
  }
  return width !== null && height !== null && width <= 24 && height <= 24;
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+[;,]/.test(value.trim().toLowerCase());
}

export function upgradeInsecureUrl(value: string, secure: boolean): string {
  if (!secure) return value;
  const trimmed = value.trimStart();
  if (!/^http:\/\//i.test(trimmed)) return value;
  const leading = value.slice(0, value.length - trimmed.length);
  return `${leading}https://${trimmed.slice(7)}`;
}

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
function sanitizeMailCss(css: string, dark: boolean): string {
  let out = css.replace(/[<>]/g, '');
  out = out.replace(/@import[^;]*;/gi, '');
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, _quote, value: string) =>
    value.trim().toLowerCase().startsWith('data:image/') ? match : 'none',
  );
  out = out
    .split(';')
    .filter((declaration) => !/expression\(|javascript:|vbscript:|behavior:|-moz-binding/i.test(declaration))
    .join(';');
  return dark ? darkenMailCss(out) : out;
}

export function sanitizeMailHtml(
  input: string,
  options: SanitizeMailOptions = {},
): SanitizedMail {
  if (!input) return { html: '', blockedRemoteImages: 0 };
  const securePage =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const styles: string[] = [];
  const withoutStyles = input.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const cleanCss = sanitizeMailCss(css, options.dark === true);
    if (cleanCss.trim() !== '') styles.push(cleanCss);
    return '';
  });
  const clean = DOMPurify.sanitize(withoutStyles, {
    USE_PROFILES: { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ['target', 'rel'],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
  });

  const template = document.createElement('template');
  template.innerHTML = (styles.length > 0 ? `<style>${styles.join('\n')}</style>` : '') + clean;
  if (options.dark) darkenMailStyles(template.content);
  let blockedRemoteImages = 0;

  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    const style = element.getAttribute('style');
    if (style && /url\s*\(/i.test(style)) {
      element.removeAttribute('style');
      if (/url\s*\(\s*['"]?(?:https?:)?\/\//i.test(style)) blockedRemoteImages += 1;
    }
    const linkTarget = element.getAttribute('href');
    const backgroundSource = element.getAttribute('data-background-src');
    if (backgroundSource) {
      const secureBackground = upgradeInsecureUrl(backgroundSource, securePage);
      if (isRemoteUrl(secureBackground)) {
        if (options.allowRemoteImages) {
          element.setAttribute('background', secureBackground);
        } else {
          blockedRemoteImages += 1;
        }
      }
      element.removeAttribute('data-background-src');
    }
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
      const secureSource = upgradeInsecureUrl(source, securePage);
      if (isRemoteUrl(secureSource)) {
        if (options.allowRemoteImages) {
          element.setAttribute('src', secureSource);
          element.removeAttribute('data-blocked-src');
        } else if (isTrackingPixel(element)) {
          element.remove();
        } else {
          blockedRemoteImages += 1;
          if (isSmallImage(element)) {
            element.remove();
          } else {
            element.removeAttribute('src');
            element.setAttribute('data-blocked-src', secureSource);
            element.setAttribute('alt', element.getAttribute('alt') || '');
          }
        }
      } else if (/^cid:/i.test(source)) {
        const resolved = options.cidImages?.[normalizeContentId(source.slice(4))];
        if (resolved) {
          element.setAttribute('src', resolved);
          element.removeAttribute('data-blocked-src');
        } else {
          element.remove();
        }
      } else if (isImageDataUrl(source)) {
        element.setAttribute('src', source);
        element.removeAttribute('data-src');
        element.removeAttribute('data-blocked-src');
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

export function createMailFrameDocument(bodyHtml: string, dark = false): string {
  const scheme = dark ? 'dark' : 'light';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="${scheme}"><base target="_blank"><style>
    :root { color-scheme: ${scheme}; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { padding: 20px; font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif; color: CanvasText; overflow-wrap: anywhere; }
    img { max-width: 100%; height: auto; }
    img[data-blocked-src] { display: inline-block; min-width: 16px; min-height: 16px; border: 1px dashed GrayText; border-radius: 6px; background: transparent; }
    a { color: LinkText; }
    table { max-width: 100%; border-collapse: collapse; }
    td, th { padding: 2px; }
    blockquote { margin: 0 0 0 0.75rem; padding-left: 0.75rem; border-left: 3px solid GrayText; color: GrayText; }
    pre { white-space: pre-wrap; word-break: break-word; }
    :focus-visible { outline: 2px solid Highlight; outline-offset: 2px; }
  </style></head><body>${bodyHtml}</body></html>`;
}
