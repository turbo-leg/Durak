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

## Second reader: Gemini 4 Argon (2026-11-12)

Gemini is a second reader, not a native speaker's final word. Its answers to the card-table questions above:

- **Suits (гил / бунд / дөрвөлжин / цэцэг), face cards (боол / хатан / ноён / тамга), suit-first names («гил 9»), Хузур, and the buttons Хаях / Хаах / Авах:** it says keep all of them as they are (about 90-100% sure; «хүзүр» would read as _neck_). **Still worth a quick yes from a human who plays at a real table.**
- **Already applied (grammar that was clearly wrong):**
  - Case endings that break on card names and numbers: `{attack}-г`, `{card}-р`, `{n}-т`, `{name}-ийн`.
  - «ширээгээ ав» ("pick up your table") became «бүгдийг нь ав» / «ширээн дээрх хөзрийг ав».
  - «тоглолтыг хожлоо» became «тоглолтод яллаа».
  - «Та суудлаа өгнө» (offering a bus seat) became «Таны суудал сулрана».
  - «Дасгалын гар» became «Дадлагын тоглолт».
  - «Багийг санамсаргүй» became «Санамсаргүй баг».
  - «Та харж байна» became «Та тоглолт үзэж байна».
  - Double instrumentals like «хөзрөөр бөөнөөр» were shortened.
  - «Final» is now «Эцсийн дүн».
  - Stiff phrases on the home screen and the guided hand were loosened.

### Not changed: please ask a native speaker

| Question                                                                                                                                          | Gemini says                                                                                                   | Why it was left alone                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| The draw pile is «Хөзөр»; is **Газрын хөзөр** (or **Газар**) what people say?                                                                     | Yes (95%): «Хөзөр дууссан» can read as "all cards are gone"                                                   | A vocabulary choice, and it appears in many lines    |
| **Морь** (HORSE mode) is a literal translation of the basketball game; does it mean anything to your audience?                                    | No; suggests spelling out "5 losses" or renaming                                                              | A naming decision for you                            |
| **Хүн бүр өөрөө** for free-for-all                                                                                                                | **Хүн бүр амиа**                                                                                              | Not sure that works as a button label                |
| **Төвд** («Recenter» button)                                                                                                                      | Reads as _Tibet_ with a capital letter; suggests **Төвлөх** / **Голлуулах**                                   | A short word was chosen on purpose, to fit phones    |
| **Энгийн** is used for both Classic and the Casual outfit                                                                                         | Outfit could be **Чөлөөт**                                                                                    | Different screens, so low risk                       |
| **Тэнэг** as a page label (`Durak home`)                                                                                                          | Reads like an insult alone; keep it for sentences like «тэнэг үлдэх»                                          | Only a screen-reader label                           |
| The long mass-attack rules paragraph (distributive «тав таваар», «тийм олон»), the Huzur swap line, «Өөр хөзөр», the sort pills, «Дахиад» gesture | Several small grammar and wording fixes (full text in `Projects\durak\gemini-mn-review.md`, outside the repo) | Longer text, needs a native read rather than a guess |

Gemini's own flag worth a second look: buttons in the _-х_ form (Хаях / Хаах / Авах) are right, but the "Tone" bullet above says buttons use the short command form (Хая, Ав). The code uses the _-х_ form.
