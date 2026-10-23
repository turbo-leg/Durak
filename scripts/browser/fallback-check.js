// Run with playwright-cli run-code --filename after starting a 3D match.
async function browserFallbackCheck(page) {
  const table = page.getByRole('img', { name: /^Interactive 3D Durak table/ });
  await table.waitFor();
  await table.evaluate((canvas) => {
    const context = canvas.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss simulation is unavailable');
    extension.loseContext();
  });
  await page.getByRole('status').filter({ hasText: '3D view is unavailable' }).waitFor();
  if (await page.locator('canvas').count()) throw new Error('Lost renderer was not removed');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Try 3D view' }).click();
    await table.waitFor();
    await page.getByRole('button', { name: '2D view', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Try 3D view' }).click();
  await table.waitFor();
  if ((await page.locator('canvas').count()) !== 1) throw new Error('Unexpected renderer count');
  return { contextLossFallback: 'passed', viewSwitchCycles: 4, activeCanvases: 1 };
}
