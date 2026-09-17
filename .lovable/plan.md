# Add your uploaded logo as the site icon (favicon)

Your uploaded `IMG-20260901-WA0001.jpg` is a circular "JYOTHI AYURVEDA" logo (green leaves, gold Dhanvantari statue, navy text) — a 1280×1280 square. That's a perfect source for a favicon.

## What I'll do
1. Copy your uploaded logo into the project at `public/favicon.png`, downscaled to a square 64×64 (the proportions are preserved — the circular logo stays circular, not stretched). A favicon is a static file bundled into the build, so it lives in `public/`, not in backend storage.
2. Update the site `<head>` links in `src/routes/__root.tsx` so the icon points at `/favicon.png` instead of the default `/favicon.ico`.
3. Delete the old template `public/favicon.ico` so browser tabs and bookmarks stop showing the stale default icon.
4. (Optional — say yes if you want it) Replace the green Leaf icon next to the hospital name in the top bar with your circular logo, and point the push-notification icon in `public/sw.js` at it too.
5. You then click **Publish → Update** so the new favicon ships to the live site.

## One note on favicon legibility
At very small sizes (16×16 browser-tab size) the fine statue detail and the small "JYOTHI AYURVEDA" text will be hard to read — but the green circular mark with the gold center will still be clearly recognizable, which is what a favicon needs. The full-size logo keeps all detail wherever it's shown larger.

If you'd prefer, I can also generate a simplified, bolder icon mark (just the leaf + gold drop, no tiny text) that reads even sharper at 16×16, and use your full logo for the top bar instead. Just say so.

## After publishing
Browser tab icons are cached aggressively, so it can take a few minutes — and on some browsers a hard refresh or re-adding the bookmark — for the new icon to appear. This is normal and not a bug.
