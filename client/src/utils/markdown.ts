import DOMPurify from 'dompurify'
import { marked } from 'marked'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderer = new marked.Renderer()

renderer.code = ({ text, lang }) => {
  const language = (lang || 'text').trim() || 'text'
  const encodedCode = encodeURIComponent(text)

  return `
    <figure class="md-codeblock">
      <figcaption class="md-codeblock__header">
        <span class="md-codeblock__language">${escapeHtml(language)}</span>
        <button type="button" class="md-codeblock__copy" data-copy-code="${encodedCode}">复制</button>
      </figcaption>
      <pre class="md-codeblock__body"><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre>
    </figure>
  `
}

marked.setOptions({
  breaks: true,
  gfm: true,
  renderer
})

export const renderMarkdown = (content: string) => {
  const html = marked.parse(content) as string

  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['button'],
    ADD_ATTR: ['data-copy-code']
  })
}
