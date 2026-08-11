# Category icons

Marker glyphs are generated as inline SVG from the `shape` + `color` fields in
`js/categories.js`, so nothing is required in this folder.

To use real artwork for a category instead, drop a file here and point at it:

```js
weaponCase: { group: 'collectibles', color: '#f0a726', icon: 'assets/icons/weapon-case.svg' },
```

The `icon` field wins over `shape`. Square images around 32x32 work best.
