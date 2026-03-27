import { useState } from "react";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { GuildPanelDefinition, GuildPanelRenderProps } from "./types";

interface MarkdownConfig {
  content: string;
}

const markdownComponents = {
  a: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  // Block images to prevent tracking pixels / unwanted external content
  img: () => null,
};

function MarkdownContent({ config, isEditing, onConfigChange }: GuildPanelRenderProps<MarkdownConfig>) {
  const [editing, setEditing] = useState(false);
  const content = config.content || "";
  const displayContent = content || "# Welcome to our Guild!\n\nEdit this panel to add your own content.";

  if (isEditing && editing) {
    return (
      <div className="h-full flex flex-col gap-2">
        <textarea
          className="flex-1 w-full resize-none rounded-md border border-border bg-background p-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          value={content}
          placeholder="Enter markdown content..."
          onChange={(e) => onConfigChange?.({ content: e.target.value })}
          onBlur={() => setEditing(false)}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Supports Markdown. Click outside to preview.</p>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div
        className="h-full cursor-text"
        onClick={() => setEditing(true)}
      >
        {content ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown components={markdownComponents}>{displayContent}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Click to edit this text block
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown components={markdownComponents}>{displayContent}</ReactMarkdown>
    </div>
  );
}

export const MarkdownPanel: GuildPanelDefinition<MarkdownConfig> = {
  type: "markdown",
  label: "Text Block",
  icon: <FileText className="h-4 w-4" />,
  description: "Rich text content block",
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 12, h: 8 },
  configSchema: [
    {
      name: "content",
      label: "Content",
      type: "textarea",
      placeholder: "Enter markdown content...",
      defaultValue: "",
    },
  ],
  defaultConfig: {
    content: "",
  },
  render: (props) => <MarkdownContent {...props} />,
};
