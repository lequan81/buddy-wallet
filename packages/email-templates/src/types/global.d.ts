// Type declarations for Svelte files
declare module '*.svelte' {
  import type { Component } from 'svelte';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: Component<any, any, any>;
  export default component;
}

// Type declarations for better-svelte-email
declare module 'better-svelte-email/render' {
  import type { Component } from 'svelte';

  interface RenderOptions {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props?: Record<string, any>;
  }

  class Renderer {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(component: Component<any, any, any>, options?: RenderOptions): Promise<string>;
  }

  export default Renderer;
}
