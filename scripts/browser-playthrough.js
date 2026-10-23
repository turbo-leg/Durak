// Run with playwright-cli run-code after opening a real Solo match in 3D.
// Uses public table text and keyboard controls; never reads private server state.
async function browserPlaythrough(page) {
  const controls = page.getByRole('button', { name: 'Card controls', exact: true });
  if (await controls.count()) await controls.click();
  const parse = (text) => {
    const label = text.replace(/^Select /, '');
    if (label.includes('Joker'))
      return { label, rank: label.startsWith('Red') ? 18 : 17, suit: 'None', joker: true };
    const [name, suit] = label.split(' of ');
    const ranks = { Jack: 11, Queen: 12, King: 13, 3: 14, 2: 15, Ace: 16 };
    return { label, rank: ranks[name] ?? Number(name), suit, joker: false };
  };
  const beats = (def, atk, trump) => {
    if (def.joker) return !atk.joker || def.rank > atk.rank;
    if (atk.joker) return false;
    return (
      (def.suit === atk.suit && def.rank > atk.rank) || (def.suit === trump && atk.suit !== trump)
    );
  };
  let actions = 0;
  const trace = [];
  for (let tick = 0; tick < 240 && actions < 100; tick++) {
    if (await page.getByRole('button', { name: /Rematch/ }).count())
      return { finished: true, actions };
    // Read one coherent DOM frame instead of mixing data from different patches.
    const view = await page.evaluate(() => ({
      hand: Array.from(
        document.querySelectorAll('button[aria-label^="Select "]:not(:disabled)'),
      ).map((node) => node.getAttribute('aria-label')),
      incoming: Array.from(document.querySelectorAll('[aria-label="Incoming attack"] li')).map(
        (node) => node.textContent,
      ),
      trump: document.querySelector('[aria-label^="Trump suit: "]')?.getAttribute('aria-label'),
      status: document.querySelector('[aria-label="Table state"]')?.textContent,
      myTurn: /Your move\.|Your defense\./.test(
        document.querySelector('.turn-banner h1')?.textContent || '',
      ),
    }));
    if (!view.hand.length || !view.trump || !view.myTurn) {
      await page.waitForTimeout(200);
      continue;
    }
    for (const selected of await page
      .locator('button[aria-label^="Select "][aria-pressed="true"]')
      .all()) {
      await selected.press('Enter');
    }
    const hand = view.hand.map(parse);
    const incoming = view.incoming.map(parse);
    const trump = view.trump.replace('Trump suit: ', '');
    const chosen = [];
    const used = new Set();
    const match = (index) => {
      if (index === incoming.length) return true;
      for (let i = 0; i < hand.length; i++) {
        if (!used.has(i) && beats(hand[i], incoming[index], trump)) {
          used.add(i);
          chosen.push(hand[i]);
          if (match(index + 1)) return true;
          chosen.pop();
          used.delete(i);
        }
      }
      return false;
    };
    if (!incoming.length) chosen.push([...hand].sort((a, b) => a.rank - b.rank)[0]);
    else if (!match(0)) {
      if (!(await page.getByRole('button', { name: 'Pick up', exact: true }).count())) {
        return { finished: false, actions, mismatch: view, trace };
      }
      await page.getByRole('button', { name: 'Pick up', exact: true }).click({ timeout: 3000 });
      actions++;
      await page.waitForFunction(
        (before) => document.querySelector('[aria-label="Table state"]')?.textContent !== before,
        view.status,
        { timeout: 4000 },
      );
      await page.waitForTimeout(200);
      continue;
    }
    for (const card of chosen)
      await page.getByRole('button', { name: `Select ${card.label}`, exact: true }).press('Enter');
    trace.push({ incoming: view.incoming, chosen: chosen.map((c) => c.label) });
    if (trace.length > 5) trace.shift();
    await page
      .getByRole('button', { name: incoming.length ? /^Defend/ : /^Play cards/ })
      .click({ timeout: 3000 });
    actions++;
    await page.waitForFunction(
      (before) => document.querySelector('[aria-label="Table state"]')?.textContent !== before,
      view.status,
      { timeout: 4000 },
    );
    await page.waitForTimeout(200);
  }
  return {
    finished: false,
    actions,
    status: await page.getByRole('region', { name: 'Table state' }).innerText(),
  };
}
