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
 *   3. Hold on to every AudioContext the engine builds, and resume them when the
 *      shell says a real finger landed — see below.
 *
 * ## Why the audio needed its own bridge
 *
 * The builds ship their sound (star-vein has three BGM loops and fourteen effects;
 * night-tide has eleven effects and no music), and none of it was audible: no
 * speaker icon on the tab, which means the AudioContext never left `suspended`.
 *
 * Godot does try. Its `_godot_audio_resume()` calls `ctx.resume()` off its own
 * input path, and the synthetic KeyboardEvents this file dispatches do fire those
 * listeners. But a script-made event is not user activation, and Chrome will not
 * start an AudioContext for a frame that has never been activated — the handheld
 * is driven entirely from buttons in the *parent* page, so nothing ever touches
 * the iframe. `allow="autoplay"` on the frame is necessary and not sufficient.
 *
 * So the shell forwards the gesture it does have: a real `pointerdown` on a
 * console button posts `joi-audio-resume`, and this bridge resumes on the other
 * side, where the contexts live.
 *
 * Reaching them is the catch. `GodotAudio` is a `var` inside the engine bundle and
 * never touches `window`, so the only way to hold a context is to be there when it
 * is constructed. This script is injected immediately *before* the engine's
 * `<script src="index.js">` for exactly that reason: it wraps the constructor
 * first, and every context the engine makes lands in a list this bridge owns.
 *
 * Idempotent: re-running after a re-export is the intended workflow.
 *
 *   node scripts/godot/patch-web-shell.mjs public/games/star-vein/index.html
 */
import { readFileSync, writeFileSync } from "node:fs";

const MARKER = "joi-shell-input-bridge";

const BRIDGE = `		<script data-${MARKER}>
// Injected by scripts/godot/patch-web-shell.mjs — do not hand-edit, re-run the script.

/*
 * Audio. This block runs before the engine bundle, which is the only moment the
 * contexts it builds can be caught — see the file header.
 */
const capturedAudioContexts = [];
const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
if (NativeAudioContext) {
	// A subclass rather than a wrapping function, so \`instanceof\` and the prototype
	// chain stay exactly what the engine expects to find.
	class ShellAudioContext extends NativeAudioContext {
		constructor(...args) {
			super(...args);
			capturedAudioContexts.push(this);
		}
	}
	window.AudioContext = ShellAudioContext;
	window.webkitAudioContext = ShellAudioContext;
}

const resumeCapturedAudio = () => {
	capturedAudioContexts.forEach((ctx) => {
		// Resuming a running context is a no-op, so this stays cheap to call on
		// every button press — which is what makes it robust: the context may not
		// exist yet the first few times the shell asks.
		if (ctx.state !== 'running') ctx.resume().catch(() => {});
	});
	return capturedAudioContexts.map((ctx) => ctx.state);
};

/*
 * A probe, because the next question after "did the context start" is "is anything
 * coming out of it", and neither is answerable from the parent page: GodotAudio
 * never reaches window, so without this there is nothing to inspect.
 *
 * From the shell's console, the frame being same-origin:
 *   document.querySelector('iframe').contentWindow.__joiAudio.report()
 *   document.querySelector('iframe').contentWindow.__joiAudio.beep()
 *
 * beep puts a plain oscillator on the engine's own context and its own destination.
 * Audible means the context, the output device and the browser are all fine, and any
 * remaining silence is the game not playing anything.
 *
 * Which, as of 2026-09-01, is exactly what it is: neither pack contains a single
 * AudioStreamPlayer. See docs/design-audits/game-center-audio-2026-09.md. The resume
 * path below is still needed and still correct — it is what lets the driver's context
 * run at all — but it cannot make audible a game that never plays a sound.
 */
window.__joiAudio = {
	report: () => ({
		contexts: capturedAudioContexts.map((ctx) => ({
			state: ctx.state,
			sampleRate: ctx.sampleRate,
			// A currentTime that does not advance is a context that is not processing.
			currentTime: ctx.currentTime,
			baseLatency: ctx.baseLatency,
			destinationChannels: ctx.destination.channelCount,
		})),
		sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
		crossOriginIsolated: window.crossOriginIsolated,
	}),
	resume: resumeCapturedAudio,
	beep: (seconds = 0.6) => {
		const ctx = capturedAudioContexts[0];
		if (!ctx) return 'no AudioContext captured yet — insert a cartridge first';
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = 440;
		gain.gain.value = 0.15;
		osc.connect(gain).connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + seconds);
		return 'A440 for ' + seconds + 's on ' + ctx.state + ' context @ ' + ctx.sampleRate + 'Hz';
	},
};

const reportAudioState = () => {
	window.parent.postMessage({
		type: 'joi-audio-state',
		contexts: capturedAudioContexts.map((ctx) => ctx.state),
	}, '*');
};

// Anything real that happens inside the frame is activation in its own right.
['pointerdown', 'keydown', 'touchstart'].forEach((name) => {
	window.addEventListener(name, (event) => {
		if (event.isTrusted) resumeCapturedAudio();
	}, true);
});

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
	if (data && data.type === 'joi-audio-resume') {
		resumeCapturedAudio();
		reportAudioState();
		return;
	}
	if (!data || data.type !== 'joi-key' || (data.action !== 'keydown' && data.action !== 'keyup')) return;
	// A forwarded press is the shell telling us a real finger landed on a button.
	resumeCapturedAudio();
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

/*
 * Strip any bridge already in the file before inserting this one.
 *
 * Matching on the marker attribute alone was not enough, and the way it failed is
 * worth keeping: `night-tide/index.html` carried a hand-edited bridge from before
 * the marker existed, so the check found nothing, and re-running this script
 * appended a *second* copy. Two `joi-key` listeners means every forwarded press is
 * dispatched to the canvas twice.
 *
 * So the test is what the block *does* rather than how it is labelled: any inline
 * `<script>` that handles `joi-key` is a bridge and gets replaced. That covers the
 * marked ones, the hand-edited one, and whatever the next export brings.
 */
const bridgePattern = /\t*<script(?: [^>]*)?>(?:(?!<\/script>)[\s\S])*?['"]joi-key['"][\s\S]*?<\/script>\n+/g;
const removed = (html.match(bridgePattern) ?? []).length;
html = html.replace(bridgePattern, "");

const anchor = '\t\t<script src="index.js"></script>';
if (!html.includes(anchor)) {
	console.error(`Could not find the engine script tag in ${target}; is this a Godot 4 web export?`);
	process.exit(1);
}
html = html.replace(anchor, BRIDGE + anchor);

if (title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

// One trailing newline, no more: the bridge's own blank line used to survive to EOF and
// `git diff --check` flags it on every re-export.
writeFileSync(target, `${html.replace(/\s+$/, "")}\n`);
console.log(`patched ${target}${removed ? ` (replaced ${removed} existing bridge${removed > 1 ? "s" : ""})` : ""}${title ? ` (title: ${title})` : ""}`);
