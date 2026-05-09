<script lang="ts">
	import { Shield, AlertTriangle } from '@repo/icons';
</script>

<div class="rounded-lg border bg-muted/30 p-4">
	<div class="flex items-start gap-3">
		<Shield class="mt-0.5 h-5 w-5 text-primary" />
		<div class="space-y-1">
			<h4 class="text-sm font-medium">Security Recommendations</h4>
			<ul class="space-y-1 text-xs text-muted-foreground">
				<li>• Use a password with at least 8 characters and varied types.</li>
				<li>• Change your password every 90 days for better security.</li>
				<li>• Review active sessions regularly to ensure no unauthorized access.</li>
				<li>• Never share your password or verification codes with anyone.</li>
			</ul>
		</div>
	</div>
</div>

<div class="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/5 p-4">
	<AlertTriangle class="mt-0.5 h-5 w-5 text-warning" />
	<div class="space-y-1">
		<h4 class="text-sm font-medium text-warning">Advanced Security</h4>
		<p class="text-xs text-muted-foreground">
			Two-factor authentication (2FA) is coming soon to provide an extra layer of protection for
			your account.
		</p>
	</div>
</div>
