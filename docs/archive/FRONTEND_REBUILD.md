# Interactive card room

The previous screen composition is retired from the application entry point. Reuse the authoritative connection/auth providers, immutable public snapshot and tested Three.js resource lifecycle. Replace the navigation shell, home, lobby, hand controls and results. Historical components remain as reference until their account/shop functionality is migrated; they are not mounted in the new play flow.

## Direction

Palette: midnight room `#101e2c`, blue wool `#244e68`, walnut `#48312c`, copper `#c69c72`, pearl cards `#f3f0e6`, pale blue `#a7d1e5`. Georgia display typography evokes a card club; Segoe UI handles controls. No gold casino chrome, stock hero art or repeated dashboard cards.

The memorable element is a physical table, viewed at a shallow overhead angle. Spatial hand selection, hover lift, bounded camera orbit and moving cards make it interactive. UI surrounds the table instead of framing it inside a panel. Clear confirmations retain server authority and prevent accidental play. A DOM hand supports keyboard, touch and WebGL failure.

```text
Durak / card room                     Rules     Account

Make yourself                   opponent seats
at home.                    /-------------------\
                           /    blue-felt table   \     Play dock
                           \   deck / live cards  /     Solo / Friends
                            \----- your hand ---/      Join / Create

Table instructions                              View / keyboard hand
```

During play, replace the home heading/dock with turn status, public room details and selection/action controls. On mobile stack the dock below a full-width table; keep controls in document flow without covering cards. Reduced motion disables camera parallax and snaps deal transitions.

Review against the brief: an ordinary casino reskin would retain gold pills, multiple view shells and a small canvas. This design instead removes those shells, uses the same spatial scene for entry and play, and makes the table the dominant surface. Procedural materials and card textures are appropriate; raster generation is unnecessary for this scene.

## Acceptance

Exercise new home → Solo → complete match → rematch → refresh, private create/join/ready/start, public room discovery, custom settings, keyboard hand, 3D picking/orbit, 2D/context-loss fallback, desktop/mobile sizing. Keep existing network/privacy/custom-rule checks. Account/shop migration and physical-device GPU performance must be tracked honestly.
