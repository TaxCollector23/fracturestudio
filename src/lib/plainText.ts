export function toPlainText(input: string): string {
  if (!input) {
    return '';
  }

  return input
    .normalize('NFKC')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-zA-Z]*\n?|```/g, ''))
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\s-{3,}\s/g, '\n\n')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/^\s*\|(.+)\|\s*$/gm, (_match, row: string) => row.split('|').map((cell: string) => cell.trim()).filter(Boolean).join('    '))
    .replace(/\|\s*[-:]{2,}\s*/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
