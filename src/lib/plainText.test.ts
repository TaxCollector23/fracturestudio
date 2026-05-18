import { describe, expect, it } from 'vitest';
import { analyzeArgument, renderFractureAnalysis } from './fractureEngine';
import { toPlainText } from './plainText';

describe('toPlainText', () => {
  it('strips markdown-heavy rendered analysis into frontend-friendly text', () => {
    const rendered = renderFractureAnalysis(
      analyzeArgument('Schools should restrict phone use because a 2024 district survey showed fewer interruptions.'),
    );
    const plain = toPlainText(rendered);

    expect(plain).toMatch(/fracture verdict/i);
    expect(plain).toMatch(/argument strength score/i);
    expect(plain).toContain('Overall');
    expect(plain).not.toMatch(/^##/m);
    expect(plain).not.toMatch(/^\s*[-*+]\s/m);
    expect(plain).not.toContain('```');
  });

  it('normalizes common markdown, links, tables, blockquotes, and code fences', () => {
    const plain = toPlainText(`## Result
**Bold claim** and _careful warrant_ with [source](https://example.com).

> quoted context

| Claim | Evidence |
| --- | --- |
| phones distract | 2024 survey |

\`\`\`ts
const verdict = 'plain enough';
\`\`\``);

    expect(plain).toContain('Result');
    expect(plain).toContain('Bold claim and careful warrant with source (https://example.com).');
    expect(plain).toContain('quoted context');
    expect(plain).toContain('Claim    Evidence');
    expect(plain).toContain("const verdict = 'plain enough';");
    expect(plain).not.toMatch(/[*_`>]/);
    expect(plain).not.toMatch(/^\|$/m);
  });
});
