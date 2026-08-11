# Item pictures

`npm run images` fills this folder automatically: it matches every gun in
`data/items.json` to its [Ghost Recon Wiki](https://ghostrecon.fandom.com/) page,
downloads the in-game render, and saves it as `<item-id>.jpg` at 900px wide.
Re-running skips files that already exist; `--force` redownloads them.

Those renders are Ubisoft's, hosted by a fan wiki — the same footing as the map
tiles. Fine for a personal build; ask before republishing.

Attachments (scopes, magazines, muzzles, stocks) have no wiki pages, so they
show their in-game description and no picture. Same for a couple of guns the
wiki does not cover. Drop your own screenshot in as `<item-id>.jpg` and it will
be picked up — run `npm run items` afterwards so the catalogue links it.

You can also attach images to a single marker rather than to a catalogue item:
put the file here and type its bare filename into the editor's "Image files"
box. `p227.jpg` resolves to `assets/items/p227.jpg`.

Keep them small: 900px on the long edge at JPEG ~80 is plenty for a popup
thumbnail and the lightbox.
