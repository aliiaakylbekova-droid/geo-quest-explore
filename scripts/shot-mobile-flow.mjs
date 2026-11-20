import { mkdir, access } from "node:fs/promises"
import { constants } from "node:fs"
import puppeteer from "puppeteer-core"

const out = process.env.SHOT_DIR || "/cursor/stores/self/media/geo-quest/mobile-flow"
const url = process.env.SHOT_URL || "http://127.0.0.1:47231/"
const chrome = process.env.CHROME || "/usr/bin/google-chrome"

await mkdir(out, { recursive: true })

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

const phones = [
  { name: "320", width: 320, height: 694 },
  { name: "360", width: 360, height: 740 },
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "414", width: 414, height: 896 },
  { name: "430", width: 430, height: 932 },
]

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: [
    "--hide-scrollbars",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--window-size=1440,900",
    "--no-sandbox",
    "--disable-dev-shm-usage",
  ],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
page.setDefaultTimeout(30000)
await page.setUserAgent(
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
)

async function shot(name) {
  const file = `${out}/${name}.png`
  await page.screenshot({ path: file, type: "png" })
  await access(file, constants.F_OK)
  console.log("ok", name, file)
}

async function boot() {
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await page.evaluate((p) => {
    localStorage.setItem("gq-tutorial-done", "1")
    localStorage.setItem("gq-profile", JSON.stringify({ name: "Алия", avatar: "ocean", createdAt: Date.now() }))
    localStorage.setItem("gq-progress", JSON.stringify(p))
    sessionStorage.removeItem("gq-journey")
  }, progress)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => Boolean(window.geoQuestDebug), { timeout: 20000 })
  await page.evaluate(() => {
    window.geoQuestDebug?.skipTutorial?.()
    window.geoQuestDebug?.finishIntro?.()
  })
  const nick = await page.$(".intro-nick")
  if (nick) {
    await page.click(".intro-start")
    await sleep(900)
  }
  await page.evaluate(() => {
    window.geoQuestDebug?.finishIntro?.()
    window.geoQuestDebug?.continent?.("Asia")
    window.geoQuestDebug?.finishIntro?.()
    window.geoQuestDebug?.hub?.()
  })
  await sleep(500)
}

async function startExplore() {
  await page.evaluate(() => {
    window.geoQuestDebug?.finishIntro?.()
    window.geoQuestDebug?.journey?.("Europe")
    window.geoQuestDebug?.journeyStart?.()
    window.geoQuestDebug?.finishIntro?.()
  })
  await page.waitForSelector(".gq-live.is-journey, [data-stage='explore']", { timeout: 12000 })
  await sleep(900)
}

await boot()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
await page.evaluate(() => window.geoQuestDebug?.hub?.())
await sleep(700)
await shot("desktop-hub")

await page.evaluate(() => window.geoQuestDebug?.journey?.("Europe"))
await sleep(700)
await shot("desktop-continent-pick")

await page.evaluate(() => window.geoQuestDebug?.journeyStart?.())
await sleep(1200)
const extraStart = await page.evaluate(() => {
  const tutorial = document.querySelector("[data-tutorial='first']")
  const overlay = document.querySelector(".gq-journey-overlay")
  return Boolean(tutorial) || Boolean(overlay)
})
if (extraStart) {
  console.error("FAIL extra screen after START JOURNEY")
  await shot("FAIL-extra-screen")
  process.exitCode = 2
}
await shot("desktop-explore-mission")

await page.evaluate(() => window.geoQuestDebug?.journeyHit?.())
await sleep(280)
await shot("desktop-explore-correct")
await sleep(1300)
await shot("desktop-explore-next-ready")

async function phoneExplore(width, height, dpr = 2) {
  await page.setViewport({ width, height, deviceScaleFactor: dpr, isMobile: false, hasTouch: true })
  await sleep(200)
  const onLive = await page.evaluate(() => Boolean(document.querySelector(".gq-live.is-journey, .gq-live[data-stage='explore']")))
  if (!onLive) {
    await page.evaluate(() => {
      window.geoQuestDebug?.skipTutorial?.()
      window.geoQuestDebug?.finishIntro?.()
      const start = document.querySelector(".intro-start")
      if (start) start.click()
    })
    await sleep(800)
    await page.evaluate(() => {
      window.geoQuestDebug?.finishIntro?.()
      window.geoQuestDebug?.continent?.("Asia")
      window.geoQuestDebug?.finishIntro?.()
      window.geoQuestDebug?.journey?.("Europe")
      window.geoQuestDebug?.journeyStart?.()
      window.geoQuestDebug?.finishIntro?.()
    })
    await sleep(900)
  }
}

await phoneExplore(820, 1180)
await sleep(600)
await shot("tablet-explore")

for (const phone of phones) {
  await phoneExplore(phone.width, phone.height)
  await sleep(400)
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  console.log("viewport", phone.name, overflow.scrollWidth, overflow.clientWidth)
  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    console.error("horizontal overflow at", phone.name)
    process.exitCode = 3
  }
  await shot(`phone-${phone.name}-explore`)
}

await phoneExplore(390, 844)
await page.evaluate(() => document.querySelector(".hud-more-toggle")?.click())
await sleep(400)
await shot("phone-390-more-howto")
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => /Как играть|How to play/i.test(b.textContent || ""))
  btn?.click()
})
await sleep(500)
await shot("phone-390-howto")

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
await page.evaluate(() => document.querySelector("[data-tutorial='first'] button")?.click())
await sleep(400)
await page.evaluate(() => window.geoQuestDebug?.hub?.())
await sleep(400)
await page.evaluate(() => window.geoQuestDebug?.journey?.("Europe"))
await page.evaluate(() => window.geoQuestDebug?.journeyStart?.())
await sleep(800)
await page.evaluate(() => window.geoQuestDebug?.fly?.(48.8, 2.3, 3.4))
await sleep(900)
await shot("desktop-labels-zoom")

await browser.close()
console.log("done", out)
