// marked is loaded as a global via CDN <script> tag

export function render(text, isMarkdown) {
  if (isMarkdown && typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  const el = document.createElement('pre');
  el.textContent = text;
  return el.outerHTML;
}
