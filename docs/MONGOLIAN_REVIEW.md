# Mongolian UI: what a native speaker should check

All Mongolian UI text lives in `packages/client/src/i18n/mn.ts`, one line per phrase: the English on the left, the Mongolian
on the right. To change a phrase, edit only the right-hand side and keep anything in `{braces}` as it is. `npm test` fails if
a phrase is missing or a `{placeholder}` is dropped.

Try it at `/?lang=mn`, or with the МН / EN button in the header. Phones set to Mongolian open in Mongolian automatically.

## Card words (please confirm or correct)

| English                                       | Used now                           | Question                                                          |
| --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Spades / Hearts / Diamonds / Clubs            | гил / бунд / дөрвөлжин / цэцэг     | Are these what your family says?                                  |
| Jack / Queen / King / Ace                     | боол / хатан / ноён / тамга        | Same question.                                                    |
| A card's name                                 | «гил 9», «бунд хатан» (suit first) | Or «9 гил»?                                                       |
| Trump (the Huzur)                             | Хузур                              | Is this the right spelling: хузур, хузир or хүзүр?                |
| Ground card (the face-up card under the deck) | Доод хөзөр                         |                                                                   |
| Attack / defend / pick up                     | орох / хаах / авах                 | The buttons say «Хаях» (play), «Хаах» (defend), «Авах» (pick up). |
| Mass attack                                   | бөөнөөр орох                       | Is there a common word for this?                                  |
| The game itself                               | тэнэг                              |                                                                   |

## Choices worth a second look

- **Headline:** «Тэнэг болохгүй шүү!» (_Don't be the fool!_). Under it: «Хамгийн сүүлд хөзөртэй үлдсэн хүн тэнэг болно.»
- **Tone:** buttons use the short command form (Хая, Ав). Messages use «та» where they address the player.
- **Shortened to fit phones:** «Дүрэм» (How to play), «Гарах» (Leave table), «Төвд» (Recenter), «1 x 1» (1v1).
- **Mode names:** Морь (Horse), Баг (Teams), Энгийн (Classic). Морь is a literal translation of the English game name, HORSE.
- **Character names:** Зэс, Ногоон, Хөх, Шар, Энгийн (literally the colours of the English names Copper, Sage, Indigo, Ochre,
  Casual).

## Not translated yet

- **Bot names:** Orgil, Jagaa, Mugii and the rest come from the server in Latin letters. Cyrillic names (Оргил, Жагаа, Мөгий)
  are a separate small change.
- **Rare messages:** server messages not listed in `mn.ts` (rare errors) still show in English.
