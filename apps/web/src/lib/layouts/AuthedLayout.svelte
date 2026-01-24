<script lang="ts">
  // import Sidebar from '$lib/components/layouts/Sidebar.svelte'; // Future Sidebar
  
  let { children } = $props();
</script>

<div class="relative flex min-h-dvh flex-col bg-background">
<!-- Authed Layout usually has a sidebar or specific nav -->
  
  <main
    class="relative flex flex-1 flex-col overflow-hidden bg-primary-foreground pt-16"
  >
    <!-- Background Gradients (Moved from old layout) -->
    <div class="pointer-events-none absolute inset-0 z-0">
      <div
        class="absolute top-0 left-0 size-128 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-[7.5rem]"
      ></div>
      <div
        class="absolute right-0 bottom-0 size-148 translate-x-1/3 translate-y-1/3 rounded-full bg-purple-600/10 blur-[8.5rem]"
      ></div>
    </div>

    <div class="relative z-10 flex flex-1 flex-col">
      {@render children()}
    </div>
  </main>
</div>
