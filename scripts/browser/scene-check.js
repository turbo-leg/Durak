// Run on the new home screen with a settled 3D table.
async function browserSceneCheck(page) {
  const controls = page.getByRole('button', { name: 'Card controls', exact: true });
  if (await controls.count()) await controls.click();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No spatial table');
  let picked = false;
  // Screen-space probing exercises the actual raycaster, without renderer internals.
  for (const y of [0.65, 0.7, 0.75, 0.8]) {
    for (const x of [0.4, 0.5, 0.6]) {
      await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
      if (await page.locator('button[aria-label^="Select "][aria-pressed="true"]').count()) {
        picked = true;
        break;
      }
    }
    if (picked) break;
  }
  if (!picked) throw new Error('3D hand picking did not select a card');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
  await page.waitForTimeout(500);
  const before = await canvas.screenshot();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await canvas.screenshot();
  if (before.equals(after)) throw new Error('Camera orbit did not change the rendered view');
  return { spatialCardPicking: 'passed', cameraOrbit: 'passed' };
}
