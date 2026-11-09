# Sound

Every sound has a built-in placeholder synthesized with the Web Audio API, so the site works with
no audio files at all. To use your own, put the file in this folder and set its path in
`src/config/audio.ts`, e.g. `chime: "/audio/chime.mp3",`. A cue left as `null` keeps the
placeholder.

One-shot cues (`files`):

| Cue | When it plays |
|---|---|
| `curtain` | The curtain opens |
| `moon` | The moon brightens |
| `chime` | The beam lights the crystal |
| `rise` | The crystal shoots up |
| `impact` | It hits the moon |
| `swirl` | The shards spiral into the moon |
| `chord` | The moon turns sapphire; the card opens |
| `whoosh` | The beam of light in year 4 |
| `breeze` | The train moves to the next car (year 2); the fall through the clouds (year 3) |
| `step` | A step in the snow (year 3) |
| `icebell` | An ice block (year 3) or a photo board (year 4) lights up |
| `plank` | A step on the bridge of light (year 4) |

Loops (`loops`), which must loop seamlessly:

| Cue | When it plays |
|---|---|
| `train` | The train in year 2; follows its speed |
| `cosmos` | A soft cosmic hum (years 2 and 4) |
| `wind` | Mountain wind in year 3; rises with altitude and gusts |

Short `.mp3` or `.ogg` files work best, with the silence at the start trimmed. Everyone can mute
the sound, and the choice is remembered.
