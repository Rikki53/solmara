import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';

async function main() {
  mkdirSync('screenshots', { recursive: true });

  // Start local server
  const server = spawn('node', ['serve.ts', '--port', '8085'], { stdio: 'inherit' });
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  const shots = ['chase', 'street', 'drive', 'mission'];
  const filenames = ['1-chase.jpg', '2-street.jpg', '3-drive.jpg', '4-mission.jpg'];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const filename = filenames[i];
    const page = await context.newPage();
    
    console.log(`Capturing shot: ${shot}...`);
    await page.goto(`http://localhost:8085/index.html?shot=${shot}&seed=1`, { waitUntil: 'networkidle' });
    // Wait a moment for WebGL scene to render and animate
    await page.waitForTimeout(1200);

    const path = `screenshots/${filename}`;
    await page.screenshot({ path, type: 'jpeg', quality: 85 });
    
    const stats = statSync(path);
    console.log(`Saved ${path} (${stats.size} bytes)`);
    await page.close();
  }

  await browser.close();
  server.kill();
  console.log('All screenshots captured successfully.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
