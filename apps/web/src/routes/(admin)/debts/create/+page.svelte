<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Card from '$lib/components/ui/card';
    import { ArrowLeft, Loader2 } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    let { form } = $props();
    let isSubmitting = $state(false);

    $effect(() => {
        if (form?.message) {
            toast.error(form.message);
            isSubmitting = false;
        }
    });
</script>

<div class="container max-w-lg py-10">
    <Button variant="ghost" href="/dashboard" class="mb-6 pl-0 hover:bg-transparent">
        <ArrowLeft class="mr-2 h-4 w-4" /> Back to Dashboard
    </Button>

    <Card.Root>
        <Card.Header>
            <Card.Title>Add New Debt</Card.Title>
            <Card.Description>Record a transaction with a friend.</Card.Description>
        </Card.Header>
        <Card.Content>
            <form method="POST" use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                    await update();
                    isSubmitting = false;
                };
            }} class="space-y-6">
                
                <div class="space-y-3">
                    <Label>Who is this with?</Label>
                    <Input name="counterpartyPhone" type="tel" placeholder="Phone Number (e.g. 0901234567)" required />
                    <p class="text-xs text-muted-foreground">Their phone number must match what they used to sign up.</p>
                </div>

                <div class="space-y-3">
                    <Label>What is the direction?</Label>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <input type="radio" name="direction" value="LEND" id="lend" class="peer sr-only" checked />
                            <Label
                                for="lend"
                                class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-checked:border-primary cursor-pointer"
                            >
                                <span class="text-xl mb-2">📤</span>
                                <span class="font-semibold">I LENT</span>
                                <span class="text-xs text-muted-foreground">(They owe me)</span>
                            </Label>
                        </div>
                        <div>
                            <input type="radio" name="direction" value="BORROW" id="borrow" class="peer sr-only" />
                            <Label
                                for="borrow"
                                class="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-checked:border-primary cursor-pointer"
                            >
                                <span class="text-xl mb-2">📥</span>
                                <span class="font-semibold">I BORROWED</span>
                                <span class="text-xs text-muted-foreground">(I owe them)</span>
                            </Label>
                        </div>
                    </div>
                </div>

                <div class="space-y-3">
                    <Label for="amount">Amount</Label>
                    <div class="relative">
                        <span class="absolute left-3 top-2.5">$</span>
                        <Input id="amount" name="amount" type="number" min="0" step="0.01" class="pl-8" placeholder="0.00" required />
                    </div>
                </div>

                <div class="space-y-3">
                    <Label for="description">Note</Label>
                    <Input id="description" name="description" placeholder="Lunch, Movie, etc." required />
                </div>

                <Button type="submit" class="w-full" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" /> Saving...
                    {:else}
                        Create Record
                    {/if}
                </Button>
            </form>
        </Card.Content>
    </Card.Root>
</div>
