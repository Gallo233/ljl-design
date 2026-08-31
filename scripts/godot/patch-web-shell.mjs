#!/usr/bin/env node
/*
 * Injects the portfolio shell's input bridge into a Godot 4 web export.
 *
 * A Godot export ships a stock index.html. The Game Center needs two things the
 * stock shell does not do:
 *
 *   1. Accept `joi-key` messages from the parent page and replay them on the
 *      canvas as KeyboardEvents — so the 3D handheld's D-pad drives the build.
 *      Dispatched on the canvas *without* focusing it: focus() blurs the parent,
 *      whose own safety cleanup would release the held key before the synthetic
 *      keydown was even delivered.
 *   2. Mirror real key events back out as `joi-game-key` — because Godot pulls
 *      keyboard focus into its iframe on first input, after which the parent
 *      stops seeing keys and the console's buttons would stop lighting up.
 *
 * Idempotent: re-running after a re-export is the intended workflow.
 *
 *   node scripts/godot/patch-web-shell.mjs public/games/star-vein/index.html
 */
import { readFileSync, writeFileSync } from "node:fs";

const MARKER = "joi-shell-input-bridge";

const BRIDGE = `		<script data-${MARKER}>
// Injected by scripts/godot/patch-web-shell.mjs — do not hand-edit, re-run the script.
const forwardedShellKeys = new Map();
const forwardedKeyId = (data) => data.code || data.key;

const releaseForwardedShellKeys = () => {
	const canvas = document.getElementById('canvas');
	if (!canvas) {
		forwardedShellKeys.clear();
		return;
	}
	forwardedShellKeys.forEach((data) => {
		canvas.dispatchEvent(new KeyboardEvent('keyup', {
			bubbles: true,
			cancelable: true,
			key: data.key || '',
			code: data.code || '',
			view: window,
		}));
	});
	forwardedShellKeys.clear();
};

window.addEventListener('message', (event) => {
	const data = event.data;
	if (!data || data.type !== 'joi-key' || (data.action !== 'keydown' && data.action !== 'keyup')) return;
	const canvas = document.getElementById('canvas');
	if (!canvas) return;
	const keyId = forwardedKeyId(data);
	if (data.action === 'keydown') forwardedShellKeys.set(keyId, data);
	else forwardedShellKeys.delete(keyId);
	canvas.dispatchEvent(new KeyboardEvent(data.action, {
		bubbles: true,
		cancelable: true,
		key: data.key || '',
		code: data.code || '',
		view: window,
	}));
});

window.addEventListener('blur', releaseForwardedShellKeys);
window.addEventListener('pagehide', releaseForwardedShellKeys);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) releaseForwardedShellKeys();
});

window.addEventListener('keydown', (event) => {
	if (!event.isTrusted) return;
	window.parent.postMessage({ type: 'joi-game-key', action: 'keydown', key: event.key, code: event.code }, '*');
}, true);

window.addEventListener('keyup', (event) => {
	if (!event.isTrusted) return;
	window.parent.postMessage({ type: 'joi-game-key', action: 'keyup', key: event.key, code: event.code }, '*');
}, true);
		</script>

`;

const [target, title] = process.argv.slice(2);
if (!target) {
	console.error("usage: patch-web-shell.mjs <exported index.html> [document title]");
	process.exit(1);
}

let html = readFileSync(target, "utf8");

if (html.includes(`data-${MARKER}`)) {
	// Replace the previous bridge rather than stacking a second copy.
	html = html.replace(new RegExp(`\\t*<script data-${MARKER}>[\\s\\S]*?</script>\\n+`), "");
}

const anchor = '\t\t<script src="index.js"></script>';
if (!html.includes(anchor)) {
	console.error(`Could not find the engine script tag in ${target}; is this a Godot 4 web export?`);
	process.exit(1);
}
html = html.replace(anchor, BRIDGE + anchor);

if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

writeFileSync(target, html);
console.log(`patched ${target}${title ? ` (title: ${title})` : ""}`);
