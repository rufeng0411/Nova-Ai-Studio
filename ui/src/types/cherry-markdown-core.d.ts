declare module 'cherry-markdown/dist/cherry-markdown.core.js' {
  const Cherry: new (options: Record<string, unknown>) => {
    getMarkdown?: () => string;
    getValue?: () => string;
    setMarkdown?: (md: string) => void;
    setValue?: (md: string) => void;
    destroy?: () => void;
  };
  export default Cherry;
}

declare module 'cherry-markdown/dist/cherry-markdown.css';
