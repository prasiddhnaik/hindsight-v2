import { isValidElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "~/app/_components/code-block";

interface MarkdownMessageProps {
  text: string;
}

interface CodeElementProps {
  children?: ReactNode;
  className?: string;
}

export function MarkdownMessage({ text }: MarkdownMessageProps) {
  return (
    <div className="markdown min-w-0 text-base leading-7 text-ink">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            if (!isValidElement<CodeElementProps>(children)) {
              return <pre>{children}</pre>;
            }
            const code = String(children.props.children ?? "").replace(/\n$/, "");
            const language = children.props.className?.match(/language-([^\s]+)/)?.[1];
            return <CodeBlock code={code} language={language} />;
          },
          table({ children }) {
            return (
              <div className="max-w-full overflow-x-auto">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
