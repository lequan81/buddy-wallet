<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Search, ShieldAlert, CheckCircle, ArrowRight } from "@lucide/svelte";
  import { createApi } from '$lib/eden';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';

  let phoneNumber = $state('');
  let searchResult = $state<{ found: boolean; count: number } | null>(null);
  let isSearching = $state(false);

  // Show success toast after login
  $effect(() => {
    if (page.url.searchParams.get('login') === 'success') {
      toast.success('Welcome back! You are now signed in.');
      goto('/', { replaceState: true });
    }
  });

  async function handleSearch() {
    if (!phoneNumber) return;
    isSearching = true;
    searchResult = null;
    
    try {
        const res = await fetch(`http://localhost:3000/v1/public/check-debt?phoneNumber=${encodeURIComponent(phoneNumber)}`);
        const data = await res.json();
        searchResult = data;
    } catch (e) {
        console.error(e);
    } finally {
        isSearching = false;
    }
  }
</script>

<div class="flex flex-col min-h-[calc(100vh-4rem)]">
  <!-- Hero Section -->
  <section class="flex-1 flex flex-col items-center justify-center space-y-10 py-24 text-center md:py-32">
     <div class="container flex max-w-5xl flex-col items-center gap-4 text-center">
        <Badge variant="outline" class="px-4 py-1 text-sm bg-accent/50">Now with SMS Notifications</Badge>
        <h1 class="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
           Track Debts with <span class="text-primary">Buddy Wallet</span>
        </h1>
        <p class="max-w-2xl leading-normal text-muted-foreground sm:text-xl sm:leading-8">
           The easiest way to manage personal debts between friends and family. Transparent, fast, and secure.
        </p>
        
        <!-- CTA Buttons (Only if not logged in) -->
        {#if !page.data.user}
            <div class="mt-8 flex gap-4">
                <Button href="/login" variant="default" size="lg">Get Started</Button>
                <Button href="/about" variant="ghost" size="lg">Learn more <ArrowRight class="ml-2 h-4 w-4" /></Button>
            </div>
        {/if}

        <!-- Search Box -->
        <Card.Root class="w-full max-w-md mt-8 p-1 shadow-lg bg-card/80 backdrop-blur">
           <div class="flex w-full items-center space-x-2 p-2">
              <Input 
                type="tel" 
                placeholder="Enter phone number to check..." 
                class="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg shadow-none"
                bind:value={phoneNumber}
                onkeydown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button size="icon" onclick={handleSearch} disabled={isSearching}>
                 {#if isSearching}
                    <span class="animate-spin">⌛</span>
                 {:else}
                    <Search class="h-5 w-5" />
                 {/if}
              </Button>
           </div>
        </Card.Root>

        <!-- Result Stats -->
        {#if searchResult}
           <div class="mt-4 animate-in fade-in slide-in-from-top-2">
              {#if searchResult.found}
                 <div class="flex items-center gap-2 rounded-md bg-yellow-100 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
                    <ShieldAlert class="h-5 w-5" />
                    <span class="font-medium">Found {searchResult.count} active record(s) linked to this number.</span>
                 </div>
                 <div class="mt-4 flex gap-4 justify-center">
                    <Button href="/login" size="lg">Login to View Details</Button>
                 </div>
              {:else}
                 <div class="flex items-center gap-2 rounded-md bg-green-100 p-3 text-green-800 dark:bg-green-900/30 dark:text-green-500">
                    <CheckCircle class="h-5 w-5" />
                    <span class="font-medium">No active debts found for this number.</span>
                 </div>
              {/if}
           </div>
        {/if}

     </div>
  </section>

  <!-- Feature Grid -->
  <section class="container space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24">
     <div class="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-5xl md:grid-cols-3">
        <Card.Root class="p-6">
            <h3 class="font-bold">Transparent</h3>
            <p class="text-sm text-muted-foreground">Clear records so everyone knows who owes what.</p>
        </Card.Root>
        <Card.Root class="p-6">
            <h3 class="font-bold">Secure</h3>
            <p class="text-sm text-muted-foreground">Your data is encrypted and only visible to involved parties.</p>
        </Card.Root>
        <Card.Root class="p-6">
            <h3 class="font-bold">Fast</h3>
            <p class="text-sm text-muted-foreground">Add debts in seconds with our optimized interface.</p>
        </Card.Root>
     </div>
  </section>
</div>
