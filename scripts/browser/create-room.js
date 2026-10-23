// Start on the home page. Run with playwright-cli run-code --filename.
async function browserCreateRoom(page) {
  await page.getByRole('tab', { name: 'With friends' }).click();
  await page.getByRole('button', { name: 'Create a private table' }).click();
  await page.getByRole('heading', { name: 'Your table.' }).waitFor();
  return {
    roomId: (await page.getByRole('button', { name: 'Copy room code' }).innerText())
      .replace('Copy code', '')
      .trim(),
  };
}
