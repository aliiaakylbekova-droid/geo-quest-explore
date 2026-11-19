import { mkdir } from "node:fs/promises"
import puppeteer from "puppeteer-core"

const out = process.env.SHOT_DIR
const url = "http://127.0.0.1:47231/"
const chrome = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

await mkdir(out, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--hide-scrollbars",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=d3d11",
    "--window-size=1440,900",
  ],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
page.setDefaultTimeout(28000)
await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
)
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false })

async function shot(name) {
  const file = `${out}/${name}.png`
  await page.screenshot({ path: file, type: "png" })
  console.log(name, file)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const progress = {
  xp: 180,
  coins: 80,
  achievements: ["first-step", "globe-spin"],
  stamps: [],
  visited: ["KG", "KZ", "FR"],
  missionsDone: [],
  journal: [],
  difficulty: "easy",
  volume: 0.7,
  musicOn: false,
  sfxOn: false,
  musicVol: 0.1,
  sfxVol: 0.1,
  locale: "ru",
  campaignIndex: 0,
  campaignDone: [],
  loginStreak: 2,
  bestLoginStreak: 2,
  lastLoginDate: "",
  loginDates: [],
  playStreak: 3,
  bestPlayStreak: 3,
  dailyDate: "",
  dailyTasks: [],
  dailyComplete: false,
  flagUnlocked: ["KG"],
  learningContinent: "Asia",
  continentXp: 40,
  continentStats: {},
  puzzleDone: [],
  questStreak: 2,
  bestQuestStreak: 2,
  lastQuestDate: "",
  weeklyKey: "",
  weekly: [],
  journeyAwarded: [],
}

await page.goto(url, { waitUntil: "domcontentloaded" })
await page.evaluate((p) => {
  localStorage.setItem("gq-tutorial-done", "1")
  localStorage.setItem("gq-profile", JSON.stringify({ name: "Алия", avatar: "ocean", createdAt: Date.now() }))
  localStorage.setItem("gq-progress", JSON.stringify(p))
  sessionStorage.removeItem("gq-journey")
}, progress)
await page.reload({ waitUntil: "domcontentloaded" })
await page.waitForSelector("[data-intro='plaque'], .intro-nick, .gq-live, .gq-hub", { timeout: 15000 })
await sleep(700)
await shot("01-register-logo")

const nick = await page.$(".intro-nick")
if (nick) {
  await page.click(".intro-start")
  await sleep(1600)
}

await page.waitForFunction(() => Boolean(window.geoQuestDebug), { timeout: 12000 })
await page.evaluate(() => {
  window.geoQuestDebug?.skipTutorial?.()
  const start = document.querySelector(".intro-start, .intro-journey")
  if (start) start.click()
})
const tile = await page.$(".gq-continent-tile")
if (tile) {
  await tile.click()
  await sleep(3200)
}
await page
  .waitForFunction(() => document.querySelector(".gq-live")?.getAttribute("data-intro") === "ready", { timeout: 12000 })
  .catch(() => null)
await page.evaluate(() => window.geoQuestDebug?.finishIntro?.())
await sleep(800)
await page.evaluate(() => window.geoQuestDebug?.hub?.())
await sleep(700)
await shot("02-hub-journey")

await page.evaluate(() => window.geoQuestDebug?.puzzle?.())
await sleep(2400)
await shot("03-puzzle-terrain")

await page.evaluate(() => {
  const btn = document.querySelector(".gq-piece")
  if (!btn) return
  const r = btn.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse" }))
  const map = document.querySelector(".gq-puzzle-map")
  const mr = map?.getBoundingClientRect()
  const mx = (mr?.left ?? 200) + (mr?.width ?? 400) * 0.55
  const my = (mr?.top ?? 120) + (mr?.height ?? 300) * 0.45
  document.querySelector(".gq-puzzle")?.dispatchEvent(
    new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: mx, clientY: my, pointerId: 1, pointerType: "mouse" }),
  )
})
await sleep(250)
await shot("04-puzzle-drag")
await page.evaluate(() => {
  document.querySelector(".gq-puzzle")?.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: 400, clientY: 400, pointerId: 1, pointerType: "mouse" }),
  )
})

await page.evaluate(() => window.geoQuestDebug?.hub?.())
await sleep(400)
await page.evaluate(() => window.geoQuestDebug?.journey?.("Asia"))
await sleep(500)
await shot("05-where-to-today")

await page.evaluate(() => window.geoQuestDebug?.journeyStart?.())
await sleep(1200)
await shot("06-explore-indicator")

for (let i = 0; i < 5; i += 1) {
  await page.evaluate(() => window.geoQuestDebug?.journeyHit?.())
  await sleep(350)
}
await sleep(800)
await shot("07-intertitle-flags")

await page.evaluate(() => window.geoQuestDebug?.journeyContinue?.())
await sleep(900)
await shot("08-flags-fill")
await page.evaluate(() => window.geoQuestDebug?.journeyHit?.())
await sleep(1400)
await shot("09-flags-fireworks")

await browser.close()
console.log("done")
