# Add a site icon (favicon) for the published site

## What you'll do
1. Upload your logo image file in this chat (attach it to your next message). A square image works best. PNG, JPG, or SVG all fine.

## What I'll do once you upload it
1. Copy your logo into the project at `public/favicon.png`, downscaled and padded to a square 64×64 so it stays crisp in browser tabs and bookmarks (the original proportions are preserved — a wide wordmark won't be stretched).
2. Update the site's `<head>` links in `src/routes/__root.tsx` to point the icon at `/favicon.png` instead of the default `/favicon.ico`.
3. Delete the old template `public/favicon.ico` so crawlers and bookmarks that ignore the `<link>` tag don't show a stale icon.
4. (Optional, say yes if you want it) Replace the green Leaf icon next to the hospital name in the top bar with your logo image, and update the push-notification icon in `public/sw.js` to use it too.
5. You then click **Publish** → Update so the new favicon ships to the live site. Browser tab icons can take a few minutes (and sometimes a hard refresh / bookmark re-add) to update because browsers cache favicons aggressively.

## Note
- This is a static project file bundled into the build — it does not need to be stored in the backend. Once published, the icon appears in the browser tab, bookmarks, and the published site.
- If you'd rather have me generate an Ayurveda-themed logo instead, just say so and I'll generate one.
