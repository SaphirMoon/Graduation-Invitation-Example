# Graduation Invitation

An animated graduation invitation that tells a story before it hands over the card. A guide walks
the guest through four years of university as four 3D scenes, then a sealed envelope opens into an
invitation written to that guest by name.

Built with Next.js (App Router), TypeScript, GSAP and React Three Fiber (three.js). The on-screen
text is in Vietnamese; all of it lives in a few config files, so it can be rewritten in any language.

## The story

| Scene | What happens |
|---|---|
| Prologue | A curtain opens on a moonlit valley; a crystal shatters into the moon and turns it sapphire |
| Year 1 | A boat on a lake at night; photos land on the water as polaroids |
| Year 2 | A high-speed train through space; each car shows one photo |
| Year 3 | A fall through the clouds, then a climb up a snow mountain past photos in ice |
| Year 4 | A bridge of light builds out to a lighthouse island, with photo boards along it |
| Invitation | An envelope in the moonbeam opens into the card |

A glass navigation bar lets guests jump between scenes, and every link keeps its place
(`/your-guest#nam-3`). Without WebGL, or with reduced motion turned on, each scene falls back to a
calm 2D version.

On the card, the photo is a lenticular print: tilt the phone, move the mouse or swipe, and the
graduate grows up across three photos.

## Getting started

Requires Node.js 20 or later and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

- `/` is the general version, for anyone.
- `/ban-a`, `/anh-b` are personal links, declared in `src/data/guests.json`.
- `/cot/c` is a person in a group that shares one album.
- Any other path shows the general version.

Try a production build with `pnpm build && pnpm start`.

**On a phone, on the same Wi-Fi:** run `pnpm dev:lan`, find your computer's local IP address, and
open `http://<that IP>:3000` on the phone. Private address ranges are allowed in `next.config.ts`.

## Make it yours

### Your details

`src/config/invitation.ts` holds the card: date and time, place, map link, the wish, the signature,
the calendar file and an optional RSVP button. The weekday is worked out from the date.

`src/config/story.ts` holds the rest of the text: dialogue, buttons and the link preview's title.

### Guests

Each entry in `src/data/guests.json` is one link:

```json
"ban-a": { "name": "bạn A", "self": "mình", "album": "guest" }
```

| Field | Meaning |
|---|---|
| key | The link: `"ban-a"` is `/ban-a` |
| `name` | How the card addresses them: "Dear {name}," |
| `self` | How you refer to yourself with them (in Vietnamese this depends on who you're writing to). Default: `mình` |
| `album` | Which set of photos they see (see below). Without it, the default set |

The entry with an empty key (`""`) is used for `/` and for any link that isn't listed.

Templates in the config files can use `{name}` and `{self}`.

**Groups:** guests keyed `"group/name"` share the group's album and get the link `/group/name`;
only the name on the card differs. The `"cot"` entry is the group page `/cot`. A new group needs its
own route folder, like `src/app/cot/`.

### Photos

`src/data/memories.json` has a `default` set for the four years (title, dialogue, photos with
captions) and `albums` for anyone who should see different photos. An album only lists the years
and fields that differ from the default.

```json
"albums": {
  "friends": {
    "year1": { "photos": [{ "src": "/images/friends/y1/01.webp", "caption": "Our first trip" }] }
  }
}
```

- Use WebP, about 1200 px on the long edge, at most 8 per year (4 in year 4).
- Year 3 photos can carry an `altitude` label.
- `focus` (0 to 1) moves the crop along the photo's long side when a scene shows it square or 5:4.

**Your own photos on the card** are three transparent cut-outs in `public/images/me/` (`small`,
`c3`, `now`), cut flat at the bottom; their sizes and labels are in `src/data/timeline.ts`. The
ones included are placeholder silhouettes.

### Videos (optional)

Videos are hosted on Cloudinary as `authenticated` assets, so they never sit in the repository and
only play through a signed link from the site's own API route:

- the general album's videos play for everyone;
- an album's own videos play only from that guest's link.

1. Install ffmpeg (Windows: `winget install --id Gyan.FFmpeg -e`).
2. Put the video in `raw-videos/`, named after its id: `raw-videos/my-clip.mp4`. This folder is
   ignored by git.
3. Add your Cloudinary keys to `.env.local`: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`.
4. Run `pnpm upload-videos`. It compresses to 720p (kept under Cloudinary's free-plan limit of
   100 MB), makes a poster, uploads under a random public ID and records it in
   `src/data/photos.json`.
5. Set its `caption` in `photos.json`, and add `{ "video": "my-clip" }` to a year in
   `memories.json`.

Short clips loop. `--force` replaces videos already uploaded; `posterAt` picks the poster's second.

### Look and feel

| To change | File |
|---|---|
| Every color, and the light and grading of each scene | `src/config/theme.ts` |
| Prologue timing, idle animation | `src/config/timing.ts` |
| Camera path, terrain, moon, particle budgets | `src/config/world.ts` |
| Pace of each year | `src/components/year/*Timeline.ts` |
| Layout of each year's 3D scene | `src/components/three/<lake, space, snow, bridge>/*State.ts` |
| Card tilt, photo heights, transition zones | `src/data/timeline.ts` |
| Card layout and sizes | `src/components/scenes/Invitation.module.css` |
| Scene order, navigation labels | `src/components/scenes/index.ts`, `src/config/scenes.ts` |
| Fonts | `src/app/layout.tsx` |
| Sound | `src/config/audio.ts`, see `public/audio/README.md` |
| Link preview image | `public/images/og-invite.jpg` (1200 × 630) |

### Preview helpers

- `?scene=year3` opens a scene directly.
- `?t=6` jumps 6 seconds into its timeline and freezes there. Most scenes also accept labels, such as
  `?scene=year2&t=car2`.
- `?scene=invitation&t=end` shows the opened card; add `&holo=0.5` to freeze its tilt.

## Deploy

Import the repository into Vercel; no build settings are needed.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your domain, e.g. `https://invite.example.com`, so link previews use the right address. On Vercel the production domain is picked up automatically |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Videos only |

Chat apps keep a link's preview once they've seen it. After changing the preview image, a link
that was already shared shows the old one until the app refreshes it.

## Project structure

```
src/app/                 page.tsx (/) · [slug] (one guest) · cot/ (a group) · api/video-url (signed video links)
src/config/              theme · story · invitation · timing · world · audio · scenes
src/data/                guests.json · memories.json · photos.json (videos) · timeline.ts (the card's photos)
src/components/
  Story.tsx              scene manager: next scene, jumps from the bar, the address
  scenes/                one component per scene, plus 2D fallbacks
  three/                 the 3D scenes: prologue, lake, space, snow, bridge, invitation sky
  year/                  timelines of the four years · Lightbox (photos and videos)
  invitation/            envelope art · HologramPhoto (the tilting card photo)
  ui/                    SceneNav (glass bar) · buttons · sound toggle
src/lib/                 guests · memories · audio (Web Audio) · calendar file · device tilt
scripts/                 upload-videos.mjs
```

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 SaphirMoon.

You're free to use, modify and share this project, including commercially, as long as the
copyright notice and the license text stay in every copy.
