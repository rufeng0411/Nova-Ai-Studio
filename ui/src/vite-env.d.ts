/// <reference types="vite/client" />

declare module 'grapesjs' {
  const grapesjs: {
    init: (config: Record<string, unknown>) => {
      setComponents: (html: string) => void;
      getHtml: () => string;
      getCss: () => string;
      on: (event: string, handler: () => void) => void;
      destroy: () => void;
    };
  };
  export default grapesjs;
}

interface ImportMetaEnv {
 readonly VITE_IS_PLATFORM?: string;
 readonly VITE_DISABLE_LOCAL_AUTH?: string;
}

interface ImportMeta {
 readonly env: ImportMetaEnv;
}
