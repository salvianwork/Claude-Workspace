# Audio download list

The container that built this library has no access to the music and sound-effect sites, so **nothing here was downloaded automatically** and no track URLs are listed (none could be verified). Fetch the files below by hand on a machine with internet, then register each with the `add` command.

Only two licences are accepted: `CC0-1.0` and `Pixabay-Content-License`. Anything CC-BY or similar is refused by the tool.

## Status

- Music: 0 tracks (needed: at least 2 per mood = 12 tracks minimum).
- SFX: 6 synthesised backups exist (`python -m tools.audio.basic_sfx`, licence CC0-1.0, source `generated:tools/audio/basic_sfx.py`). The WAV files are git-ignored; regenerate them with that command on a fresh checkout. Real recordings (below) are preferred; aim for at least 5 per type.

## Sources and licences

| Source | What | Licence value to use |
| --- | --- | --- |
| Pixabay Music (pixabay.com/music) | Background music | `Pixabay-Content-License` |
| Kenney audio packs (kenney.nl/assets, category Audio): "Interface Sounds", "UI Audio", "Digital Audio" | SFX | `CC0-1.0` |
| Freesound (freesound.org), search with the licence filter set to Creative Commons 0 | SFX | `CC0-1.0` |
| OpenGameArt (opengameart.org), filtered to CC0 | SFX or music | `CC0-1.0` |

Use the page URL of the track or pack as `--source-url`. Check the licence shown on the page before adding.

## Music: at least 2 tracks per mood (target 15-20 in total), each 2-4 minutes, instrumental

| Mood | Tracks | Search terms (Pixabay Music) |
| --- | --- | --- |
| curious | 2+ | "curious", "quirky explainer", "pizzicato", "light mystery" |
| upbeat | 3+ | "upbeat corporate", "happy ukulele", "bright pop instrumental" |
| calm | 3+ | "calm ambient", "soft piano", "relaxing background" |
| inspiring | 3+ | "inspiring cinematic", "uplifting piano", "motivational" |
| dramatic | 2+ | "dramatic cinematic", "tension build", "epic trailer" |
| playful | 2+ | "playful", "fun kids", "whimsical xylophone" |

## Sound effects: at least 5 per type (target about 30-40 in total), each 1.2 s or shorter

| Type | Files | Search terms |
| --- | --- | --- |
| whoosh | 5+ | "whoosh", "swish", "air movement" |
| pop | 5+ | "pop", "bubble pop", "blip" |
| ding | 5+ | "ding", "notification chime", "bell ping" |
| click | 5+ | "click", "ui click", "button" (Kenney "Interface Sounds" / "UI Audio") |
| swoosh-in | 5+ | "swoosh", "transition in", "slide in" |
| reveal | 5+ | "reveal", "magic sparkle", "stinger", "positive chime" |

## Add command template

Run from the workspace root. Arguments are separate, so a path with spaces just needs quotes.

```
python -m tools.audio.library add "<path to downloaded file>" --kind music --tags <mood> --licence Pixabay-Content-License --source-url "<page URL>"
python -m tools.audio.library add "<path to downloaded file>" --kind sfx --tags <type> --licence CC0-1.0 --source-url "<page URL>"
```

`<mood>` is one of curious, upbeat, calm, inspiring, dramatic, playful. `<type>` is one of whoosh, pop, ding, click, swoosh-in, reveal. Then check with:

```
python -m tools.audio.library validate
python -m tools.audio.library list
```
