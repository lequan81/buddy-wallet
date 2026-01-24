<script lang="ts">
  // import Header from '$lib/components/layouts/Header.svelte';
  // import Footer from '$lib/components/layouts/Footer.svelte';
  
  let { children } = $props();
</script>

<div class="relative flex min-h-dvh flex-col bg-background">
  <!-- <Header /> -->
  
  <main class="flex-1">
    {@render children()}
  </main>

  <!-- <Footer /> -->
</div>
