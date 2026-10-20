import { describe, expect, it } from 'vitest';
import { createMailFrameDocument, sanitizeMailHtml, textToHtml } from './sanitize';

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

  it('loads remote images only when explicitly allowed', () => {
    const result = sanitizeMailHtml('<img src="https://images.example/a.png">', {
      allowRemoteImages: true,
    });
    expect(result.blockedRemoteImages).toBe(0);
    expect(result.html).toContain('src="https://images.example/a.png"');
  });

  it('strips inline styles that fetch remote resources', () => {
    const result = sanitizeMailHtml(
      '<p style="background-image:url(https://tracker.example/a.png)">text</p>',
    );
    expect(result.html).not.toContain('url(');
    expect(result.blockedRemoteImages).toBe(1);
  });

  it('removes cid images that cannot be resolved', () => {
    const result = sanitizeMailHtml('<img src="cid:logo">');
    expect(result.html).not.toContain('cid:');
    expect(result.blockedRemoteImages).toBe(1);
  });

  it('escapes plain text fallbacks', () => {
    expect(textToHtml('<b>not html</b>')).toContain('&lt;b&gt;');
  });

  it('builds a sandbox-ready frame document', () => {
    const documentHtml = createMailFrameDocument('<p>Body</p>');
    expect(documentHtml).toContain('<!doctype html>');
    expect(documentHtml).toContain('<p>Body</p>');
    expect(documentHtml).toContain('CanvasText');
  });
});
