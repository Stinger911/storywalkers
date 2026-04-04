function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  let html = escapeHtml(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  return html;
}

function renderMarkdownToHtml(value: string) {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let unordered: string[] = [];
  let ordered: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br />")}</p>`);
    paragraph = [];
  };

  const flushUnordered = () => {
    if (unordered.length === 0) return;
    blocks.push(`<ul>${unordered.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    unordered = [];
  };

  const flushOrdered = () => {
    if (ordered.length === 0) return;
    blocks.push(`<ol>${ordered.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
    ordered = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);

    if (!line) {
      flushParagraph();
      flushUnordered();
      flushOrdered();
      continue;
    }

    if (unorderedMatch) {
      flushParagraph();
      flushOrdered();
      unordered.push(unorderedMatch[1]);
      continue;
    }

    if (orderedMatch) {
      flushParagraph();
      flushUnordered();
      ordered.push(orderedMatch[1]);
      continue;
    }

    flushUnordered();
    flushOrdered();
    paragraph.push(line);
  }

  flushParagraph();
  flushUnordered();
  flushOrdered();

  return blocks.join("");
}

type MarkdownProps = {
  content?: string | null;
  class?: string;
};

export function Markdown(props: MarkdownProps) {
  return (
    <div
      class={props.class}
      innerHTML={renderMarkdownToHtml(props.content?.trim() ?? "")}
    />
  );
}
