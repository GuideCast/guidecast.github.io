const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const DIALOG = process.argv[3]; const DEST = process.argv[4];
const W = 1440, H = 900, PX = 940, PY = 150, TB = 30; // floating recorder frame position in composites
const pct = (r) => ({ x: +(r.x / W * 100).toFixed(2), y: +(r.y / H * 100).toFixed(2), w: +(r.w / W * 100).toFixed(2), h: +(r.h / H * 100).toFixed(2) });
const pad = (r, p = 6) => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });
const bb = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no box'); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
const inPip = (r) => ({ x: r.x + PX, y: r.y + PY + TB, w: r.w, h: r.h });
const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
const steps = [];
(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false, executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    args: ['--auto-select-tab-capture-source-by-title=Sales Portal', '--lang=en-US', '--window-position=0,0'], viewport: { width: W, height: H }, acceptDownloads: true,
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('gct_seen_welcome_v1', 'true'); } catch {} if (location.port === '5199') { Object.defineProperty(Document.prototype, 'visibilityState', { get() { return 'hidden'; } }); } });
  const t = ctx.pages()[0]; await t.goto('http://localhost:8765/portal.html');
  const a = await ctx.newPage(); const errs = [];
  a.on('pageerror', (e) => errs.push(e.message)); a.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await a.goto('http://localhost:5199/'); await a.bringToFront(); await a.waitForTimeout(2500);
  const comp = await ctx.newPage();
  const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
  const compose = async (bg, pip, extra) => {
    const html = `<html><body style="margin:0;width:${W}px;height:${H}px;position:relative;overflow:hidden;font-family:Segoe UI,Arial">
   <img src="${b64(bg)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px">
   <div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:rgba(15,23,42,.18)"></div>
   <div style="position:absolute;left:${PX}px;top:${PY}px;width:420px;border-radius:8px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);border:1px solid #334155">
     <div style="height:${TB}px;background:#1e293b;color:#e2e8f0;font-size:13px;display:flex;align-items:center;padding:0 10px;box-sizing:border-box">Floating recorder (always on top)</div>
     <img src="${b64(pip)}" style="display:block;width:420px;height:560px"></div>
   ${extra ? `<img src="${b64(extra)}" style="position:absolute;left:800px;top:250px;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6)">` : ''}
   </body></html>`;
    await comp.setViewportSize({ width: W, height: H }); await comp.setContent(html); await comp.waitForTimeout(300);
    return comp.screenshot({ type: 'jpeg', quality: 82 });
  };
  const shot = async (p) => p.screenshot({ type: 'jpeg', quality: 82 });
  const add = (name, img, box, act, en, ru) => { fs.writeFileSync(path.join(OUT, name + '.jpg'), img); steps.push({ name, box: pct(box), act, en, ru }); };
  const idb = () => a.evaluate(() => new Promise((r) => { const q = indexedDB.open('GuideCreationToolDB'); q.onsuccess = () => { q.result.transaction('projects').objectStore('projects').getAll().onsuccess = (e) => r(e.target.result); }; }));

  // 1 dashboard
  const newBtn = a.getByRole('button', { name: /^New guide$/ }).first();
  add('01', await shot(a), pad(await bb(newBtn)), 'click', 'Click <b>New guide</b>. Each guide is a separate project, saved in this browser.', 'Нажмите <b>Новый гайд</b> (New guide). Каждый гайд это отдельный проект, он хранится в этом браузере.');
  await newBtn.click(); await a.waitForSelector('[data-testid=start-recording]'); await a.waitForTimeout(2600);
  // 2 record tab
  const startBtn = a.locator('[data-testid=start-recording]');
  const recTab = await a.screenshot();
  add('02', await shot(a), pad(await bb(startBtn)), 'click', 'Click <b>Start recording</b>. One click is enough: Chrome asks which tab to record, and you do not need to come back to this tab.', 'Нажмите <b>Начать запись</b> (Start recording). Достаточно одного клика: Chrome спросит, какую вкладку записывать, и возвращаться на эту вкладку не придётся.');
  const pipP = ctx.waitForEvent('page'); await startBtn.click(); const pip = await pipP;
  await pip.setViewportSize({ width: 420, height: 560 }); await a.waitForTimeout(800);
  // 3 chrome dialog (real dialog image, cropped), shown over the guide tool as Chrome does
  const dlg = fs.readFileSync(DIALOG);
  const dlgHtml = `<html><body style="margin:0;width:${W}px;height:${H}px;position:relative;overflow:hidden"><img src="${b64(recTab)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"><div style="position:absolute;inset:0;background:rgba(15,23,42,.35)"></div><img src="${b64(dlg)}" style="position:absolute;left:415px;top:70px;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.6)"></body></html>`;
  await comp.setViewportSize({ width: W, height: H }); await comp.setContent(dlgHtml); await comp.waitForTimeout(300);
  add('03', await comp.screenshot({ type: 'jpeg', quality: 82 }), { x: 415 + 36 - 4, y: 70 + 131 - 4, w: 302 + 8, h: 30 + 8 }, 'select', 'Chrome asks what to share. On <b>Chrome Tab</b> pick the tab with your program (here: Sales Portal) and click <b>Share</b>. Do not pick the guide tool itself.', 'Chrome спросит, чем поделиться. На вкладке <b>Chrome Tab</b> (Вкладка Chrome) выберите вкладку с программой (здесь Sales Portal) и нажмите <b>Share</b> (Поделиться). Сам редактор гайдов не выбирайте.');
  await a.waitForFunction(() => document.body.innerText.includes('Recording')); await a.waitForTimeout(2200);
  const portal = await t.screenshot(); const pipLive = await pip.screenshot();
  // 4 chrome switched by itself, recorder floats on top
  add('04', await compose(portal, pipLive), { x: PX - 4, y: PY - 4, w: 428, h: TB + 568 }, 'look', 'After <b>Share</b> Chrome opens your program by itself, and the recorder floats on top of it. Work in your program as usual.', 'После <b>Share</b> (Поделиться) Chrome сам откроет вашу программу, а пульт будет плавать поверх неё. Работайте в программе как обычно.');
  // 5 resize hint
  add('05', await compose(portal, pipLive), inPip(pad(await bb(pip.locator('[data-testid=resize-hint]')), 4)), 'look', 'Recorder too small? Drag the window edge or corner to make it bigger. The tip can be closed with the cross.', 'Пульт мелкий? Потяните за край или угол окна, чтобы увеличить. Подсказку можно закрыть крестиком.');
  const vrect = async () => { const v = await bb(pip.locator('video')); const sc = Math.min(v.w / W, v.h / H); return { ox: v.x + (v.w - W * sc) / 2, oy: v.y + (v.h - H * sc) / 2, sc }; };
  const prect = async (sel) => t.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
  const toVid = async (r) => { const { ox, oy, sc } = await vrect(); return { x: ox + r.x * sc, y: oy + r.y * sc, w: r.w * sc, h: r.h * sc }; };
  const drag = async (p, r) => { await p.mouse.move(r.x, r.y); await p.mouse.down(); await p.mouse.move(r.x + r.w, r.y + r.h, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(1200); };
  // 6 snap step
  const nbV = await toVid(pad(await prect('#new'), 5));
  add('06', await compose(portal, pipLive), inPip(pad(nbV, 5)), 'drag', 'Before each click in your program, drag over that button in the recorder. This snaps the screen and frames the button: one drag, one step.', 'Перед каждым нажатием в программе обведите эту кнопку мышью в пульте. Кадр снимается, кнопка обводится рамкой: одно движение, один шаг.');
  await drag(pip, nbV);
  // 7 frozen: box and pointer
  let proj = (await idb()).find((p) => p.titleEn === 'Interactive Step Guide' && p.steps.length); let st = proj.steps[0];
  const img = await bb(pip.locator('img').first());
  const im = (bx) => ({ x: img.x + bx.x / 100 * img.w, y: img.y + bx.y / 100 * img.h, w: bx.w / 100 * img.w, h: bx.h / 100 * img.h });
  const cur = st.cursorPos || { x: st.box.x + st.box.w, y: st.box.y + st.box.h };
  const tgt = union(im(st.box), { x: img.x + cur.x / 100 * img.w - 4, y: img.y + cur.y / 100 * img.h - 4, w: 26, h: 30 });
  const pipFrozen = await pip.screenshot();
  add('07', await compose(portal, pipFrozen), inPip(pad(tgt, 8)), 'look', 'The step is frozen so you can fix it. Drag the red box or its corners, and move the pointer arrow if it covers text.', 'Шаг замер, его можно поправить. Тяните красную рамку или её углы, сдвиньте стрелку курсора, если она закрывает текст.');
  // 8 blur
  const blurBtn = pip.locator('button', { hasText: 'Draw Blur Box' }).first();
  add('08', await compose(portal, pipFrozen), inPip(pad(await bb(blurBtn), 4)), 'click', 'Private data on screen (names, emails)? Click <b>+ Draw Blur Box</b> and drag over it. Students get a blurred copy.', 'На экране личные данные (имена, почта)? Нажмите <b>+ Нарисовать Blur</b> (+ Draw Blur Box) и обведите их. Студенты получат размытую версию.');
  await blurBtn.click(); await pip.waitForTimeout(300);
  const prof = await t.evaluate(() => { const s = [...document.querySelectorAll('header span')][1].getBoundingClientRect(); return { x: s.x - 6, y: s.y - 4, w: s.width + 12, h: s.height + 8 }; });
  await drag(pip, { x: img.x + prof.x / W * img.w, y: img.y + prof.y / H * img.h, w: prof.w / W * img.w, h: prof.h / H * img.h });
  // 9 caption
  const inp = pip.locator('input[type=text], textarea').first();
  await inp.fill('Click <b>+ New report</b> to start a report');
  await pip.waitForTimeout(500);
  const actRow = await bb(pip.locator('button', { hasText: /^Click$/ }).first());
  const pipCap = await pip.screenshot();
  add('09', await compose(portal, pipCap), inPip(pad(union(actRow, await bb(inp)), 5)), 'type', 'Choose what the student does (Click, Type, Select...) and write the caption. Or press <b>Voice</b> and say it.', 'Выберите действие (Нажмите, Введите, Выберите...) и напишите подпись. Или нажмите <b>Голос</b> (Voice) и надиктуйте.');
  // 10 save & next
  const saveBtn = pip.locator('button', { hasText: 'Save Step' }).first();
  add('10', await compose(portal, pipCap), inPip(pad(await bb(saveBtn), 4)), 'click', 'Click <b>Save Step &amp; Capture Next</b>. Then do the click in your program and snap the next step the same way.', 'Нажмите <b>Сохранить шаг и снять следующий</b> (Save Step &amp; Capture Next). Затем сделайте нажатие в программе и так же снимите следующий шаг.');
  await saveBtn.click(); await pip.waitForTimeout(800);
  for (const [sel, cap] of [['nav div:nth-child(2)', 'Open <b>Reports</b> in the left menu'], ['table', 'Check the sales by store in the table']]) {
    await drag(pip, await toVid(await prect(sel)));
    await pip.locator('input[type=text], textarea').first().fill(cap);
    await pip.locator('button', { hasText: 'Save Step' }).first().click(); await pip.waitForTimeout(800);
  }
  const pipDone = await pip.screenshot();
  const finBtn = pip.locator('button', { hasText: 'Finish' }).first();
  add('11', await compose(portal, pipDone), inPip(pad(await bb(finBtn), 4)), 'click', 'All steps done? Click <b>Finish &amp; Edit Guide</b>. Recording stops and the editor opens.', 'Все шаги сняты? Нажмите <b>Завершить и открыть Редактор</b> (Finish &amp; Edit Guide). Запись остановится, откроется редактор.');
  await finBtn.click(); await a.waitForTimeout(2000);
  // 12 editor steps list
  const list = await a.evaluate(() => { const h = [...document.querySelectorAll('h2,h3,h4,span,div')].find((e) => /^Steps \(\d+\)$/.test(e.textContent.trim())); let el = h; while (el && !(el.getBoundingClientRect().height > 400 && el.getBoundingClientRect().width > 200)) el = el.parentElement; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: Math.min(r.height, 330) }; });
  const edShot = await shot(a);
  add('12', edShot, pad(list, 2), 'look', 'All your steps are here. Click a step to open it, use the arrows to reorder, the bin to delete, <b>Add</b> to insert a screenshot.', 'Здесь все шаги. Щёлкните шаг, чтобы открыть его; стрелки меняют порядок, корзина удаляет, <b>Добавить</b> (Add) вставляет скриншот.');
  proj = (await idb()).find((p) => p.titleEn === 'Interactive Step Guide' && p.steps.length === 3); st = proj.steps[0];
  const eimg = await a.evaluate(() => { const i = [...document.querySelectorAll('img')].sort((x, y) => y.width * y.height - x.width * x.height)[0].getBoundingClientRect(); return { x: i.x, y: i.y, w: i.width, h: i.height }; });
  const eb = { x: eimg.x + st.box.x / 100 * eimg.w, y: eimg.y + st.box.y / 100 * eimg.h, w: st.box.w / 100 * eimg.w, h: st.box.h / 100 * eimg.h };
  add('13', edShot, pad(eb, 10), 'drag', 'Fine-tune the red box right on the screenshot: drag it, pull its corners. This is the spot students will click.', 'Подправьте красную рамку прямо на скриншоте: перетащите её, потяните за углы. Именно сюда будет нажимать студент.');
  add('14', edShot, pad(await bb(a.locator('textarea').first()), 4), 'type', 'Edit the caption here. Tip: a button name between &lt;b&gt; and &lt;/b&gt; is shown in bold.', 'Поправьте подпись здесь. Совет: название кнопки между &lt;b&gt; и &lt;/b&gt; будет выделено жирным.');
  add('15', edShot, pad(await bb(a.locator('button', { hasText: 'Blur and more tools' }).first()), 4), 'click', '<b>Blur and more tools</b>: blur this screen or all screens at once, cover an old logo, zoom.', '<b>Размытие и другие инструменты</b> (Blur and more tools): размыть этот кадр или все сразу, закрыть старый логотип, масштаб.');
  await a.locator('button', { hasText: '3. Preview & download' }).first().click(); await a.waitForTimeout(1800);
  const pvShot = await shot(a);
  add('16', pvShot, pad(await bb(a.locator('button', { hasText: 'Guide for students (.html)' }).first()), 4), 'click', 'In <b>3. Preview &amp; download</b> click <b>Guide for students (.html)</b>. One file: opens offline in any browser, private areas blurred. Upload it to Moodle or send it.', 'На вкладке <b>3. Просмотр и скачивание</b> нажмите <b>Гайд для студентов (.html)</b>. Один файл: открывается без интернета в любом браузере, личное размыто. Загрузите в Moodle или отправьте студентам.');
  add('17', pvShot, pad(await bb(a.locator('button', { hasText: 'Save project for editing (.html)' }).first()), 4), 'click', 'Also click <b>Save project for editing (.html)</b>. It is your backup with the original screenshots. Keep it for yourself, do not share it.', 'Нажмите и <b>Сохранить проект для редактирования (.html)</b>. Это ваша копия с исходными скриншотами. Храните её у себя, студентам не отправляйте.');
  await a.locator('button', { hasText: 'All guides' }).first().click(); await a.waitForTimeout(1200);
  add('18', await shot(a), pad(await bb(a.locator('button, label', { hasText: 'Open guide or project' }).first()), 4), 'click', 'Later, on any computer: click <b>Open guide or project</b> on the start page and pick that file to keep editing. This demo is such a file too. <b>Now try it yourself:</b> open any website in another tab (for example Wikipedia) and record 3 steps.<br><a href="../?new=1" target="_top" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:10px;background:#059669;color:#fff;font-weight:700;text-decoration:none">Now try it yourself</a>', 'Позже, на любом компьютере: нажмите <b>Открыть гайд или проект</b> на главной странице и выберите этот файл, чтобы продолжить. Этот демо-гайд тоже такой файл. <b>Теперь попробуйте сами:</b> откройте любой сайт в соседней вкладке (например, Википедию) и снимите 3 шага.<br><a href="../?new=1" target="_top" style="display:inline-block;margin-top:8px;padding:10px 18px;border-radius:10px;background:#059669;color:#fff;font-weight:700;text-decoration:none">Попробовать самому</a>');
  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(steps, null, 1));
  console.log('shots done', steps.length, 'errors', errs);

  // ---- build the project in the app's own database, then export with the app's own button
  const payload = steps.map((s) => ({ ...s, img: fs.readFileSync(path.join(OUT, s.name + '.jpg')).toString('base64') }));
  await a.evaluate(async (payload) => {
    const db = await new Promise((r) => { const q = indexedDB.open('GuideCreationToolDB'); q.onsuccess = () => r(q.result); });
    const now = Date.now(); const pid = 'demo-how-to-' + now; const shots = [], st = [];
    for (const s of payload) {
      const bin = atob(s.img); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const id = 'shot-' + s.name + '-' + now;
      shots.push({ id, projectId: pid, filename: 'how-to-' + s.name + '.jpg', blob: new Blob([u], { type: 'image/jpeg' }), width: 1440, height: 900, blurBoxes: [], maskBoxes: [] });
      st.push({ id: 'step-' + s.name + '-' + now, screenshotId: id, act: s.act, box: s.box, en: s.en, ru: s.ru });
    }
    const project = { id: pid, pageTitle: 'How to make a step-by-step guide', titleEn: 'How to make a step-by-step guide', titleRu: 'Как сделать пошаговый гайд',
      subEn: 'An interactive tour of this tool: record, edit, download. Click the red box to go on.', subRu: 'Интерактивный тур по этому инструменту: запись, правка, скачивание. Нажимайте на красную рамку, чтобы идти дальше.',
      defaultLang: 'en', globalBlurBoxes: [], steps: st, createdAt: now, updatedAt: now };
    await new Promise((res, rej) => { const tx = db.transaction(['projects', 'screenshots'], 'readwrite'); tx.objectStore('projects').put(project); shots.forEach((s) => tx.objectStore('screenshots').put(s)); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }, payload);
  await a.reload(); await a.waitForTimeout(1500);
  await a.getByText('How to make a step-by-step guide').first().click(); await a.waitForTimeout(1500);
  await a.locator('button', { hasText: '3. Preview & download' }).first().click(); await a.waitForTimeout(1500);
  const dl = a.waitForEvent('download'); await a.locator('button', { hasText: 'Save project for editing (.html)' }).first().click(); const d = await dl;
  await d.saveAs(DEST); console.log('saved', d.suggestedFilename(), fs.statSync(DEST).size);
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
