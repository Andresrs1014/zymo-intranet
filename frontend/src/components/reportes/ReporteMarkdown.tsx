import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidDiagram } from "./MermaidDiagram"

const components: Components = {
  code(props) {
    const { className, children, ...rest } = props
    const isMermaid = /language-mermaid/.test(className ?? "")
    if (isMermaid) {
      return <MermaidDiagram code={String(children).replace(/\n$/, "")} />
    }
    return <code className={className} {...rest}>{children}</code>
  },
}

/** ReactMarkdown + remark-gfm compartido por editor y vista de detalle — los
 * bloques ```mermaid se renderizan como diagrama real, no como texto plano. */
export function ReporteMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
