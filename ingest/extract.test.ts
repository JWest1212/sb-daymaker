import { describe, it, expect } from 'vitest';
import { reduceToText, buildExtractUserMessage, extractTool } from './extract';

describe('reduceToText — strips chrome, keeps content', () => {
  it('removes nav/header/footer/script/style before extracting text', () => {
    const html = `<html><body>
      <header>Site Header Nav</header>
      <nav>Home About Contact</nav>
      <script>trackPageview();</script>
      <style>.x{color:red}</style>
      <main><h1>Live Music Night</h1><p>Friday, July 24 at 8pm. $10 at the door.</p></main>
      <footer>Copyright 2026</footer>
    </body></html>`;
    const text = reduceToText(html);
    expect(text).toContain('Live Music Night');
    expect(text).toContain('Friday, July 24 at 8pm');
    expect(text).not.toContain('Site Header Nav');
    expect(text).not.toContain('Home About Contact');
    expect(text).not.toContain('trackPageview');
    expect(text).not.toContain('Copyright 2026');
  });

  it('collapses whitespace and drops empty lines', () => {
    const html = '<body><p>Line one</p>\n\n\n<p>   Line two   </p></body>';
    const text = reduceToText(html);
    expect(text).toBe('Line one\nLine two');
  });

  it('caps output length so the AI payload stays small', () => {
    const html = `<body><p>${'x'.repeat(20_000)}</p></body>`;
    const text = reduceToText(html);
    expect(text.length).toBeLessThanOrEqual(6_000);
  });

  it('returns an empty string for a page with no visible text', () => {
    const html = '<body><script>foo()</script></body>';
    expect(reduceToText(html)).toBe('');
  });
});

describe('buildExtractUserMessage', () => {
  it('includes the source url and the reduced text', () => {
    const msg = buildExtractUserMessage('https://example.com/events', 'Trivia Night, Wednesdays');
    expect(msg).toContain('https://example.com/events');
    expect(msg).toContain('Trivia Night, Wednesdays');
  });
});

describe('extractTool schema', () => {
  it('forces title + confidence as the only required fields', () => {
    const props = (extractTool.input_schema as any).properties.events.items;
    expect(props.required).toEqual(['title', 'confidence']);
    expect(props.properties.confidence.enum).toEqual(['high', 'low']);
  });
  it('is strict with no additional properties, matching the enrich.ts precedent', () => {
    expect(extractTool.strict).toBe(true);
    expect((extractTool.input_schema as any).additionalProperties).toBe(false);
  });
});
