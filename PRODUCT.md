# Gallo — Product Context

## Product

Gallo is a personal portfolio for showing how its author designs and builds AI-native products. The primary experience is a continuous CRT world that opens into project-specific, light editorial or interactive spaces. The contrast is intentional: visitors leave the machine and enter the work.

## Audience and primary task

The site serves recruiters, potential collaborators, product designers and people interested in Joi. Their primary task is to experience real work quickly enough to judge its quality and completeness. Background, source code, contact and project-to-project navigation support that task; they do not compete with the product experience.

## Current route worlds

- `/`, `/selected-work`, `/about-me`, `/contact`: one continuous CRT experience with shared scroll state.
- `/work/joi`, `/work/joi-mobile`: short Living Aperture experiences built around the real Joi Web session and the real 3D iPhone presentation.
- `/play/night-tide`: Game Center with a playable 3D handheld and five cartridges.
- `/lab`: research, experiments and retired prototypes.
- `/classic`: the previous light homepage, preserved and unlinked.

## Product commitments

- Real products lead. A working experience is more important than a long case-study template.
- Do not fabricate footage, screenshots, outcomes or online states. Drawn material must remain visibly drawn; unavailable services get an honest fallback.
- Only wire assets that exist in the repository.
- Motion is causal. Scroll, drag, pointer proximity and product state should explain every major transition.
- The Work-page Living Aperture keeps its key states, topology and interaction meaning. Its material baseline uses distinct route colors—Joi ice white, Joi Mobile taro violet, Game Center sky blue and Lab Nordic smoke—while retaining restrained transmission and directional edge light.
- Game Center and Lab may adopt the Living Aperture language, but must retain their actual content and route-specific interaction model.
- About Me and Contact retain their current feeling and layout. They are explicit no-redesign boundaries for this phase.
- Never hide essential content behind rendering or animation machinery that can fail.
- Keep route handoffs, deep links, browser history, reduced motion, keyboard access and WebGL fallbacks functional.

## Living Aperture language

Living Aperture is an interface material rather than a decorative shader. Identity, experience and release are states of one responsive medium. Its signature behavior is smooth fusion, capillary bridges, stretching and breakage, fast-grab/slow-release hysteresis, pointer wake and text softening during a state change. Clear semantic DOM content remains independent from the effect.

For operational surfaces such as Game Center, the aperture is the surrounding stage and transition system. It must not replace the playable DOM, iframe or canvas with a flattened WebGL texture, shrink controls into a decorative card, or intercept input owned by the product.

## Quality constraints

- Use npm and the existing Next.js App Router architecture.
- Preserve the two-context intent of the main CRT experience.
- Work routes should remain approximately 3–5 viewports in browse mode while allowing unlimited time in explicit interact mode.
- Prefer one shared liquid renderer per experience and cap pixel density to actual on-screen need.
- Avoid continuous work when a renderer is hidden, static or visually small.
- Mobile and reduced-motion modes must remain complete, readable and operable.

## Evidence and source boundaries

The site contains genuine Joi embeds, an Apple iPhone model, the playable handheld and games, and documented shader research. Research facts marked `SOURCE`, `PARTIAL` and `GUESS` keep those confidence levels. Existing design-audit and extraction documents are evidence; stale doorway-era README material is historical context only.
