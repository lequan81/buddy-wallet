<script lang="ts">
	import Shield from '~icons/lucide/shield';
	import AlertTriangle from '~icons/lucide/alert-triangle';
</script>

<div class="rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:bg-zinc-900 dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex flex-col gap-6">
	<div class="flex items-center gap-2 border-b border-zinc-100 pb-4 dark:border-zinc-800">
		<Shield class="h-4 w-4 text-muted-foreground" />
		<h4 class="text-sm font-medium">Security Advice</h4>
	</div>

	<div class="space-y-4">
		<div class="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-800/20">
			<div class="flex items-start gap-3">
				<Shield class="mt-0.5 h-5 w-5 text-zinc-500 dark:text-zinc-400" />
				<div class="space-y-1">
					<h4 class="text-sm font-medium text-zinc-800 dark:text-zinc-200">Security Recommendations</h4>
					<ul class="space-y-1.5 text-xs text-muted-foreground pt-1">
						<li>• Use a password with at least 8 characters and varied types.</li>
						<li>• Change your password every 90 days for better security.</li>
						<li>• Review active sessions regularly to ensure no unauthorized access.</li>
						<li>• Never share your password or verification codes with anyone.</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="flex items-start gap-3 rounded-lg border border-amber-100/50 bg-amber-50/30 p-4 dark:border-amber-900/20 dark:bg-amber-950/10">
			<AlertTriangle class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-500" />
			<div class="space-y-1">
				<h4 class="text-sm font-medium text-amber-800 dark:text-amber-300">Advanced Security</h4>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Two-factor authentication (2FA) is coming soon to provide an extra layer of protection for
					your account.
				</p>
			</div>
		</div>
	</div>
</div>
