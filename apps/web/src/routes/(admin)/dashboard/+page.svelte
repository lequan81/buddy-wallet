<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Users, FileText, Clock, ArrowUpRight, Plus, Download, FileSpreadsheet } from '@lucide/svelte';
    import { Separator } from '$lib/components/ui/separator';
    import { Badge } from '$lib/components/ui/badge';
    import * as Table from "$lib/components/ui/table";
    import { Button } from '$lib/components/ui/button';
    import { page } from '$app/state';

    let { data } = $props();

    let users = $derived(data.users || []);
    let debts = $derived(data.debts || []);
    let user = $derived(page.data.user);
    
    let isAdmin = $derived(user?.role === 'admin');

    let pendingDebts = $derived(debts.filter((d: any) => d.status === 'pending'));
    let totalAmount = $derived(debts.reduce((acc: number, d: any) => acc + d.amount, 0));
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p class="text-muted-foreground">Overview of your debts and activity.</p>
        </div>
        <div class="flex gap-2">
            <Button href="/debts/create">
                <Plus class="mr-2 h-4 w-4" /> New Debt
            </Button>
            <Button variant="outline" href="/dashboard/import">
                <Download class="mr-2 h-4 w-4" /> Import
            </Button>
            <a href="/api/v1/export/debts" download class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                <FileSpreadsheet class="mr-2 h-4 w-4" /> Export
            </a>
        </div>
    </div>
    
    <Separator />

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {#if isAdmin}
            <Card.Root class="cursor-pointer hover:bg-muted/50 transition-colors" onclick={() => window.location.href = '/dashboard/users'}>
                <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Card.Title class="text-sm font-medium">Total Users</Card.Title>
                    <Users class="h-4 w-4 text-muted-foreground" />
                </Card.Header>
                <Card.Content>
                    <div class="text-2xl font-bold">{users.length}</div>
                    <p class="text-xs text-muted-foreground">Click to manage users</p>
                </Card.Content>
            </Card.Root>
        {/if}

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                <Card.Title class="text-sm font-medium">Total Debts</Card.Title>
                <FileText class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{debts.length}</div>
                <p class="text-xs text-muted-foreground">All time records</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                <Card.Title class="text-sm font-medium">Pending</Card.Title>
                <Clock class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">{pendingDebts.length}</div>
                <p class="text-xs text-muted-foreground">Active items</p>
            </Card.Content>
        </Card.Root>

        <Card.Root>
            <Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
                <Card.Title class="text-sm font-medium">Volume</Card.Title>
                <ArrowUpRight class="h-4 w-4 text-muted-foreground" />
            </Card.Header>
            <Card.Content>
                <div class="text-2xl font-bold">${totalAmount.toLocaleString()}</div>
                <p class="text-xs text-muted-foreground">Total value</p>
            </Card.Content>
        </Card.Root>
    </div>

    <!-- Recent Activity -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card.Root class="col-span-1 md:col-span-7">
            <Card.Header>
                <Card.Title>Recent Debts</Card.Title>
                <Card.Description>
                    {isAdmin ? 'Latest transactions in system.' : 'Your recent transactions.'}
                </Card.Description>
            </Card.Header>
            <Card.Content>
                <Table.Root>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Description</Table.Head>
                            <Table.Head>Status</Table.Head>
                            <Table.Head>Amount</Table.Head>
                            <Table.Head class="text-right">Date</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#if debts.length === 0}
                            <Table.Row>
                                <Table.Cell colspan={4} class="text-center h-24 text-muted-foreground">
                                    No debts found. Create one to get started!
                                </Table.Cell>
                            </Table.Row>
                        {:else}
                            {#each debts.slice(0, 5) as debt}
                                <Table.Row>
                                    <Table.Cell class="font-medium">{debt.description}</Table.Cell>
                                    <Table.Cell>
                                        <Badge variant={debt.status === 'pending' ? 'outline' : 'default'} class="capitalize">
                                            {debt.status}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>${debt.amount}</Table.Cell>
                                    <Table.Cell class="text-right text-muted-foreground">
                                        {new Date(debt.createdAt).toLocaleDateString()}
                                    </Table.Cell>
                                </Table.Row>
                            {/each}
                        {/if}
                    </Table.Body>
                </Table.Root>
            </Card.Content>
        </Card.Root>
    </div>
</div>
