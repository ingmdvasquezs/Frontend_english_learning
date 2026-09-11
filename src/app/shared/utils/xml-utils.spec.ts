import { describe, expect, it } from 'vitest';
import { escapeXml } from './xml-utils';

describe('escapeXml', () => {
  it('escapes standard XML special characters', () => {
    expect(escapeXml('Tom & Jerry <friends> "yes" \'no\'')).toBe(
      'Tom &amp; Jerry &lt;friends&gt; &quot;yes&quot; &apos;no&apos;'
    );
  });

  it('handles strings with no special characters', () => {
    expect(escapeXml('Hello world 123')).toBe('Hello world 123');
  });

  it('handles empty strings', () => {
    expect(escapeXml('')).toBe('');
  });

  it('escapes consecutive special characters', () => {
    expect(escapeXml('&&<<>>""\'\'')).toBe(
      '&amp;&amp;&lt;&lt;&gt;&gt;&quot;&quot;&apos;&apos;'
    );
  });
});