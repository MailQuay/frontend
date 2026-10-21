import { describe, expect, it } from 'vitest';
import {
  createMailFrameDocument,
  sanitizeMailHtml,
  textToHtml,
  upgradeInsecureUrl,
} from './sanitize';

describe('mail HTML sanitizer', () => {
  it('removes scripts, forms and event handlers', () => {
    const result = sanitizeMailHtml(
      '<p onclick="steal()">Hello<script>alert(1)</script></p><form action="/x"><input></form>',
    );
    expect(result.html).toContain('Hello');
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onclick');
    expect(result.html).not.toContain('<form');
    expect(result.html).not.toContain('<input');
  });

  it('removes javascript links and forces safe link attributes', () => {
    const result = sanitizeMailHtml(
      '<a href="javascript:alert(1)">bad</a><a href="https://example.com">good</a>',
    );
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain('rel="noopener noreferrer"');
  });

  it('blocks remote images by default and records the source', () => {
    const result = sanitizeMailHtml(
      '<img src="https://tracker.example/pixel.png" alt="pixel"><img src="data:image/png;base64,AAAA">',
    );
    expect(result.blockedRemoteImages).toBe(1);
    expect(result.html).not.toMatch(/\ssrc="https:/);
    expect(result.html).toContain('data-blocked-src="https://tracker.example/pixel.png"');
    expect(result.html).toContain('data:image/png;base64,AAAA');
  });

  it('hides small blocked icons but still counts them', () => {
    const result = sanitizeMailHtml(
      '<img src="https://img.example/icon.png" width="16" height="16">',
    );
    expect(result.blockedRemoteImages).toBe(1);
    expect(result.html).not.toContain('<img');
  });

  it('drops tracking pixels without counting them', () => {
    const result = sanitizeMailHtml(
      '<img src="https://mail.example/o/pixel.gif" width="1" height="1" alt="">' +
        '<img src="https://img.example/logo.png" width="40" height="40" alt="logo">',
    );
    expect(result.blockedRemoteImages).toBe(1);
    expect(result.html).not.toContain('pixel.gif');
    expect(result.html).toContain('data-blocked-src="https://img.example/logo.png"');
  });

  it('loads remote images only when explicitly allowed', () => {
    const result = sanitizeMailHtml('<img src="https://images.example/a.png">', {
      allowRemoteImages: true,
    });
    expect(result.blockedRemoteImages).toBe(0);
    expect(result.html).toContain('src="https://images.example/a.png"');
  });

  it('restores table background images only when allowed', () => {
    const html = '<table data-background-src="https://img.example/bg.png"><tr><td>x</td></tr></table>';
    const blocked = sanitizeMailHtml(html);
    expect(blocked.blockedRemoteImages).toBe(1);
    expect(blocked.html).not.toContain('background="https://img.example');

    const allowed = sanitizeMailHtml(html, { allowRemoteImages: true });
    expect(allowed.blockedRemoteImages).toBe(0);
    expect(allowed.html).toContain('background="https://img.example/bg.png"');
  });

  it('strips inline styles that fetch remote resources', () => {
    const result = sanitizeMailHtml(
      '<p style="background-image:url(https://tracker.example/a.png)">text</p>',
    );
    expect(result.html).not.toContain('url(');
    expect(result.blockedRemoteImages).toBe(1);
  });

  it('loads inline data images without treating them as remote', () => {
    const result = sanitizeMailHtml('<img data-src="data:image/png;base64,AAAA">');
    expect(result.blockedRemoteImages).toBe(0);
    expect(result.html).toContain('src="data:image/png;base64,AAAA"');
    expect(result.html).not.toContain('data-src');
  });

  it('removes cid images that cannot be resolved', () => {
    const result = sanitizeMailHtml('<img src="cid:logo">');
    expect(result.html).not.toContain('cid:');
    expect(result.blockedRemoteImages).toBe(0);
  });

  it('resolves cid images to inline data URLs', () => {
    const result = sanitizeMailHtml('<img src="cid:Image001%40Example">', {
      cidImages: { 'image001@example': 'data:image/png;base64,AAAA' },
    });
    expect(result.blockedRemoteImages).toBe(0);
    expect(result.html).toContain('src="data:image/png;base64,AAAA"');
    expect(result.html).not.toContain('cid:');
  });

  it('keeps safe style blocks and removes remote CSS loads', () => {
    const result = sanitizeMailHtml(
      '<style>@media only screen { .container { width: 95% !important } }' +
        '.bg { background: url(https://tracker.example/a.png); color: #111111 }</style>' +
        '<p class="container">text</p>',
    );
    expect(result.html).toContain('@media only screen');
    expect(result.html).toContain('.container');
    expect(result.html).toContain('text');
    expect(result.html).not.toContain('tracker.example');
  });

  it('upgrades insecure image URLs on secure pages', () => {
    expect(upgradeInsecureUrl('http://example.com/a.png', true)).toBe(
      'https://example.com/a.png',
    );
    expect(upgradeInsecureUrl('http://example.com/a.png', false)).toBe(
      'http://example.com/a.png',
    );
    expect(upgradeInsecureUrl('https://example.com/a.png', true)).toBe(
      'https://example.com/a.png',
    );
  });

  it('escapes plain text fallbacks', () => {
    expect(textToHtml('<b>not html</b>')).toContain('&lt;b&gt;');
  });

  it('builds a sandbox-ready frame document', () => {
    const documentHtml = createMailFrameDocument('<p>Body</p>');
    expect(documentHtml).toContain('<!doctype html>');
    expect(documentHtml).toContain('<p>Body</p>');
    expect(documentHtml).toContain('CanvasText');
    expect(documentHtml).toContain('color-scheme: light');
  });

  it('uses the dark color scheme when requested', () => {
    const documentHtml = createMailFrameDocument('<p>Body</p>', true);
    expect(documentHtml).toContain('color-scheme: dark');
    expect(documentHtml).toContain('name="color-scheme" content="dark"');
  });
});
