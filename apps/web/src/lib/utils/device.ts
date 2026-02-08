export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export function getDeviceInfo(): { deviceName: string; deviceType: DeviceType } {
	if (typeof navigator === 'undefined') {
		return { deviceName: 'Unknown', deviceType: 'desktop' };
	}

	const ua = navigator.userAgent;
	let deviceType: DeviceType = 'desktop';

	// Device detection
	const typePatterns = [
		{ regex: /tablet|ipad|playbook|silk/i, type: 'tablet' as const },
		{ regex: /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i, type: 'mobile' as const }
	];

	for (const { regex, type } of typePatterns) {
		if (regex.test(ua)) {
			deviceType = type;
			break;
		}
	}

	// Browser detection
	const browsers = [
		{ regex: /Chrome/i, name: 'Chrome' },
		{ regex: /Firefox/i, name: 'Firefox' },
		{ regex: /Safari/i, name: 'Safari' },
		{ regex: /Edge/i, name: 'Edge' }
	];

	let deviceName = 'Unknown Device';
	for (const { regex, name } of browsers) {
		if (regex.test(ua)) {
			deviceName = name;
			break;
		}
	}

	// OS detection
	const os = [
		{ regex: /Windows/i, name: 'Windows' },
		{ regex: /Mac/i, name: 'macOS' },
		{ regex: /Linux/i, name: 'Linux' },
		{ regex: /Android/i, name: 'Android' },
		{ regex: /iOS|iPhone|iPad/i, name: 'iOS' }
	];

	for (const { regex, name } of os) {
		if (regex.test(ua)) {
			deviceName += ` on ${name}`;
			break;
		}
	}

	return { deviceName, deviceType };
}
