// Start on the home page. Run with playwright-cli run-code --filename.
async function browserCreateRoom(page) {
  await page.getByRole('tab', { name: 'With friends' }).click();
  await page.getByRole('button', { name: 'Create a table', exact: true }).click();
  await page.getByRole('heading', { name: 'Your table', exact: true }).waitFor();
  return {
    roomId: (await page.getByRole('button', { name: 'Copy invitation link' }).innerText())
      .replace('Copy invitation link', '')
      .trim(),
  };
}
