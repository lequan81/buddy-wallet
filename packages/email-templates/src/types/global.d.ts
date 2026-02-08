// Type declarations for Svelte files
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<any, any, any>;
  export default component;
}

// Type declarations for better-svelte-email
declare module 'better-svelte-email/render' {
  import type { Component } from 'svelte';

  interface RenderOptions {
    props?: Record<string, any>;
  }

  class Renderer {
    render(component: Component<any, any, any>, options?: RenderOptions): Promise<string>;
  }

  export default Renderer;
}
