// Run on the results screen of a Solo match. Never returns the reconnect token.
async function browserRematchReconnect(page) {
  await page.getByRole('button', { name: /Rematch/ }).click();
  await page.getByRole('region', { name: 'Table state' }).waitFor();
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('durak_reconnection_token')));
  await page.reload();
  await page.getByRole('region', { name: 'Table state' }).waitFor({ timeout: 15000 });
  return {
    recovered: true,
    canvases: await page.locator('canvas').count(),
    hasToken: await page.evaluate(() =>
      Boolean(sessionStorage.getItem('durak_reconnection_token')),
    ),
  };
}
