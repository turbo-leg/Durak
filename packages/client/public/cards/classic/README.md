# Classic card faces

Artwork: [The Public Domain Deck / Austin Gabriel](https://github.com/AustinGabriel/Public-Domain-and-CC0-Playing-Cards).
License: CC0 1.0 Universal; full text retained in `LICENSE.txt`.
Source commit: `3765067c32fcef42a30e87022332db729658e7cd`.

The 42 faces used by Durak were exported from `svg cards/card fronts/` to
512 × 744 WebP at quality 92. Source art was resized to the game's card aspect
ratio; colors, illustrations and indices are unchanged. The set includes 7–K,
3, 2 and Ace in all four suits, plus red and black jokers. Game strengths 14,
15 and 16 map to printed 3, 2 and Ace respectively.

All files are served locally. No third-party network requests are made during
play. The same face URL mapping is used by the 3D table and accessible 2D cards.
The existing card-back customization is independent of this face artwork.

The `high-resolution/` variants are rendered directly from the same source SVGs
at 1024 × 1488, quality 96. The Huzur uses this version in 3D; its small public
HUD reference uses the regular image. Other cards keep the smaller textures; a face is upgraded only when
it becomes the Huzur. Texture mipmaps and up to 16× anisotropic filtering preserve
detail at the table's shallow viewing angle. Desktop cards have a light satin
clearcoat; narrow/coarse-pointer views disable clearcoat and shadows, cap DPR at
1.5 and use up to 4× anisotropy. A failed high-resolution request falls back to
the regular art before retaining the generated face as a last resort.

To reproduce, download those 42 SVGs from the pinned commit (exclude ranks 4–6
and the bonuses directory), then run:

```powershell
npx --yes --package=sharp-cli@6.1.0 sharp -i 'output/card-art-sources/*.svg' -o packages/client/public/cards/classic -f webp -q 92 resize 512 744 --fit fill
npx --yes --package=sharp-cli@6.1.0 sharp -i 'output/card-art-sources/*.svg' -o packages/client/public/cards/classic/high-resolution -f webp -q 96 resize 1024 1488 --fit fill
```
