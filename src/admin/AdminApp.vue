<script setup>
/**
 * songKHEM admin panel (/admin). Reads api/admin.js with the admin password, which stays in this tab only.
 * Shows the monthly free-scan budget, daily usage, problems (old app, too many requests, failures), recent
 * requests and whether the server is set up. Mounted on its own by main.js, outside the reading app.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { AlertTriangle, CheckCircle2, LogOut, RefreshCw, XCircle } from 'lucide-vue-next'
import DailyBars from './DailyBars.vue'

// Name of this tab's sessionStorage slot that holds what the admin typed
const SESSION_SLOT = 'songkhem_admin_session'
const AUTO_REFRESH_MS = 60 * 1000

const readSaved = () => {
  try {
    return sessionStorage.getItem(SESSION_SLOT) || ''
  } catch (_) {
    return ''
  }
}
const save = (value) => {
  try {
    if (value) sessionStorage.setItem(SESSION_SLOT, value)
    else sessionStorage.removeItem(SESSION_SLOT)
  } catch (_) {}
}

const password = ref(readSaved())
const typed = ref('')
const report = ref(null)
const loading = ref(false)
const error = ref('')
const recentFilter = ref('all')
let timer

const load = async () => {
  if (!password.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${password.value}` }, cache: 'no-store' })
    const body = await response.json().catch(() => ({}))
    if (response.status === 401) {
      password.value = ''
      save('')
      error.value = 'Wrong password.'
      return
    }
    if (!response.ok) {
      error.value = body.code === 'not_configured'
        ? 'The admin panel is not set up yet: add SONGKHEM_ADMIN_PASSWORD in Vercel and redeploy.'
        : `Could not load the data (${response.status}).`
      return
    }
    report.value = body
  } catch (_) {
    error.value = 'Could not reach the server. Check the connection.'
  } finally {
    loading.value = false
  }
}

const signIn = async () => {
  password.value = typed.value.trim()
  typed.value = ''
  save(password.value)
  await load()
}
const signOut = () => {
  password.value = ''
  report.value = null
  save('')
}

onMounted(() => {
  document.title = 'songKHEM admin'
  load()
  timer = setInterval(() => document.visibilityState === 'visible' && load(), AUTO_REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

// ---- Numbers -------------------------------------------------------------------------------------------
const month = computed(() => report.value?.month || {})
const n = (key) => Number(month.value[key]) || 0
const avgMs = (kind) => (n(`${kind}_timed`) ? Math.round(n(`${kind}_ms`) / n(`${kind}_timed`)) : null)
const seconds = (ms) => (ms == null ? '-' : `${(ms / 1000).toFixed(1)} s`)

const quota = computed(() => report.value?.quota || {})
const quotaShare = computed(() => (quota.value.used == null ? 0 : Math.min(1, quota.value.used / quota.value.cap)))
const quotaLevel = computed(() => (quotaShare.value >= 1 ? 'critical' : quotaShare.value >= 0.8 ? 'warning' : 'good'))
const resetText = computed(() => {
  if (!quota.value.resetsAt) return ''
  const at = new Date(quota.value.resetsAt)
  const days = Math.max(0, Math.ceil((at - Date.now()) / 86400000))
  const local = at.toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return `Starts again ${local} (Cambodia time), in ${days} day${days === 1 ? '' : 's'}`
})

const tiles = computed(() => [
  { label: 'Scans done', value: n('ocr_ok'), note: `${n('ocr_app')} from the app, ${n('ocr_web')} from the website` },
  { label: 'Scans that failed', value: n('ocr_fail'), note: 'Google could not read the photo or was unreachable', bad: n('ocr_fail') > 0 },
  { label: 'Read-aloud requests', value: n('tts_ok'), note: `${n('tts_app')} from the app, ${n('tts_web')} from the website` },
  { label: 'Read-aloud failures', value: n('tts_fail'), note: 'The voice service did not answer', bad: n('tts_fail') > 0 },
  { label: 'Old app blocked', value: n('ocr_denied') + n('tts_denied'), note: 'Requests without the current app pass' },
  { label: 'Too many requests', value: n('ocr_limited') + n('tts_limited'), note: 'Stopped by the server; the Vercel firewall counts its own' },
  { label: 'Average scan time', value: seconds(avgMs('ocr')), note: 'Google Vision, per page' },
  { label: 'Average read-aloud time', value: seconds(avgMs('tts')), note: 'Time to make the audio' },
])

// Series colors: the validated default categorical slots (blue, orange); text never takes these colors
const scanSeries = [
  { key: 'ocr_ok', label: 'Read', color: 'var(--a-series-1)' },
  { key: 'ocr_fail', label: 'Failed', color: 'var(--a-series-2)' },
]
const ttsSeries = [{ key: 'tts_ok', label: 'Read-aloud', color: 'var(--a-series-1)' }]
const blockedDays = computed(() =>
  (report.value?.days || []).map((d) => ({
    date: d.date,
    denied: (d.ocr_denied || 0) + (d.tts_denied || 0),
    limited: (d.ocr_limited || 0) + (d.tts_limited || 0) + (d.ocr_capped || 0),
  }))
)
const blockedSeries = [
  { key: 'denied', label: 'Old app', color: 'var(--a-series-1)' },
  { key: 'limited', label: 'Too many / monthly limit', color: 'var(--a-series-2)' },
]

// ---- Setup checklist -----------------------------------------------------------------------------------
const checks = computed(() => {
  const c = report.value?.config || {}
  return [
    { ok: c.googleVisionKey, label: 'Google Vision key', note: c.googleVisionKey ? 'Set' : 'Missing: scanning cannot work' },
    { ok: c.appPasses > 0, label: 'App pass (SONGKHEM_APP_KEY)', note: c.appPasses > 0 ? `${c.appPasses} pass${c.appPasses > 1 ? 'es' : ''} accepted` : 'Missing: any copy of the app is accepted' },
    { ok: c.storage && !report.value?.storageError, label: 'Usage storage (Upstash Redis)', note: !c.storage ? 'Not connected: no monthly cap and no history' : report.value?.storageError ? `Error: ${report.value.storageError}` : 'Connected' },
    { ok: c.storage, label: 'Monthly scan cap', note: c.storage ? `${c.monthlyCap} scans a month` : 'Off until storage is connected' },
    { ok: true, warn: !c.azureTtsKey, label: 'Azure voice key', note: c.azureTtsKey ? 'Set (paid voice)' : 'Not set: using the free voice service' },
  ]
})

// ---- Recent requests -----------------------------------------------------------------------------------
const OUTCOMES = {
  ok: ['Done', 'good'],
  fail: ['Failed', 'critical'],
  denied: ['Old app blocked', 'serious'],
  limited: ['Too many', 'warning'],
  capped: ['Monthly limit', 'serious'],
}
const recent = computed(() =>
  (report.value?.recent || []).filter((e) => recentFilter.value === 'all' || (recentFilter.value === 'problems' ? e.outcome !== 'ok' : e.kind === recentFilter.value))
)
const when = (t) => new Date(t).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const details = (e) =>
  [e.chars != null && `${e.chars} characters`, e.voice && e.voice.replace('km-KH-', ''), e.via, e.status != null && e.outcome === 'fail' && `HTTP ${e.status}`, e.reason]
    .filter(Boolean)
    .join(' · ')

const updated = computed(() => (report.value ? new Date(report.value.generatedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Phnom_Penh' }) : ''))
</script>

<template>
  <div class="admin">
    <main v-if="!report" class="signin">
      <form class="signin-card" @submit.prevent="signIn">
        <img src="/logo.png" alt="" width="48" height="48" />
        <h1>songKHEM admin</h1>
        <p v-if="loading">Loading…</p>
        <template v-else>
          <label for="pw">Admin password</label>
          <input id="pw" v-model="typed" type="password" autocomplete="current-password" required />
          <button type="submit" class="btn">Open</button>
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </form>
    </main>

    <template v-else>
      <header class="topbar">
        <div class="brand"><img src="/logo.png" alt="" width="28" height="28" /><h1>songKHEM admin</h1></div>
        <div class="top-actions">
          <span class="muted">Updated {{ updated }}</span>
          <button type="button" class="icon-btn" :disabled="loading" aria-label="Refresh" @click="load">
            <RefreshCw :size="18" :class="{ spin: loading }" />
          </button>
          <button type="button" class="icon-btn" aria-label="Sign out" @click="signOut"><LogOut :size="18" /></button>
        </div>
      </header>

      <main class="content">
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <!-- Free scans this month -->
        <section class="hero card" aria-labelledby="quota-title">
          <div>
            <h2 id="quota-title">Free scans this month</h2>
            <p v-if="quota.used == null" class="muted">Not counted yet: connect usage storage (see Setup below).</p>
            <template v-else>
              <p class="hero-number"><span>{{ quota.used }}</span> of {{ quota.cap }}</p>
              <div class="meter" role="meter" :aria-valuenow="quota.used" aria-valuemin="0" :aria-valuemax="quota.cap" aria-label="Free scans used">
                <div class="meter-fill" :class="quotaLevel" :style="{ width: `${quotaShare * 100}%` }"></div>
              </div>
              <p class="status-line" :class="quotaLevel">
                <XCircle v-if="quotaLevel === 'critical'" :size="16" /><AlertTriangle v-else-if="quotaLevel === 'warning'" :size="16" /><CheckCircle2 v-else :size="16" />
                {{ quotaLevel === 'critical' ? 'Limit reached: scanning is paused until next month' : quotaLevel === 'warning' ? 'Running low' : `${quota.cap - quota.used} scans left` }}
              </p>
              <p class="muted small">{{ resetText }}. Google's free tier is 1,000 scans a month; the app stops at {{ quota.cap }}.</p>
            </template>
          </div>
        </section>

        <!-- This month at a glance -->
        <section aria-labelledby="month-title">
          <h2 id="month-title" class="section-title">This month</h2>
          <div class="tiles">
            <div v-for="tile in tiles" :key="tile.label" class="tile card">
              <p class="tile-label">{{ tile.label }}</p>
              <p class="tile-value" :class="{ bad: tile.bad }">{{ tile.value }}</p>
              <p class="tile-note">{{ tile.note }}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="days-title">
          <h2 id="days-title" class="section-title">Last 30 days</h2>
          <div class="charts">
            <DailyBars title="Scans per day" :days="report.days" :series="scanSeries" />
            <DailyBars title="Read-aloud per day" :days="report.days" :series="ttsSeries" />
            <DailyBars title="Blocked per day" :days="blockedDays" :series="blockedSeries" />
          </div>
          <p v-if="!report.days.length" class="muted small">No history yet: it starts once usage storage is connected.</p>
        </section>

        <!-- Recent requests -->
        <section class="card" aria-labelledby="recent-title">
          <div class="recent-head">
            <h2 id="recent-title">Recent requests</h2>
            <div class="filters" role="group" aria-label="Show">
              <button v-for="f in [['all', 'All'], ['ocr', 'Scans'], ['tts', 'Read-aloud'], ['problems', 'Problems']]" :key="f[0]" type="button" class="chip" :aria-pressed="recentFilter === f[0]" @click="recentFilter = f[0]">{{ f[1] }}</button>
            </div>
          </div>
          <p class="muted small">Never the photos or the text. "Caller" is a scrambled tag for the connection, so repeat callers can be spotted.</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>What</th><th>Result</th><th>From</th><th>Caller</th><th>Country</th><th class="num">Took</th><th>Details</th></tr>
              </thead>
              <tbody>
                <tr v-for="e in recent" :key="`${e.t}-${e.who}-${e.kind}`">
                  <td class="nowrap">{{ when(e.t) }}</td>
                  <td>{{ e.kind === 'ocr' ? 'Scan' : 'Read-aloud' }}</td>
                  <td><span class="badge" :class="OUTCOMES[e.outcome]?.[1]">{{ OUTCOMES[e.outcome]?.[0] || e.outcome }}</span></td>
                  <td>{{ e.source === 'app' ? 'App' : e.source === 'web' ? 'Website' : 'Unknown' }}</td>
                  <td><code>{{ e.who }}</code></td>
                  <td>{{ e.country || '-' }}</td>
                  <td class="num">{{ e.ms ? seconds(e.ms) : '-' }}</td>
                  <td class="muted">{{ details(e) }}</td>
                </tr>
                <tr v-if="!recent.length"><td colspan="8" class="muted">Nothing yet.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Setup -->
        <div class="two-col">
          <section class="card" aria-labelledby="setup-title">
            <h2 id="setup-title">Setup</h2>
            <ul class="checks">
              <li v-for="c in checks" :key="c.label">
                <AlertTriangle v-if="c.warn" :size="18" class="warning" aria-hidden="true" />
                <CheckCircle2 v-else-if="c.ok" :size="18" class="good" aria-hidden="true" />
                <XCircle v-else :size="18" class="critical" aria-hidden="true" />
                <div><strong>{{ c.label }}</strong><span>{{ c.ok ? (c.warn ? 'Note' : 'OK') : 'Problem' }}: {{ c.note }}</span></div>
              </li>
            </ul>
          </section>
          <section class="card" aria-labelledby="deploy-title">
            <h2 id="deploy-title">Live version</h2>
            <dl class="facts">
              <dt>Environment</dt><dd>{{ report.deployment.env }}</dd>
              <dt>Commit</dt><dd><code>{{ report.deployment.commit || '-' }}</code> {{ report.deployment.branch }}</dd>
              <dt>Change</dt><dd>{{ report.deployment.message.split('\n')[0] || '-' }}</dd>
              <dt>Server region</dt><dd>{{ report.deployment.region || '-' }}</dd>
            </dl>
            <h3>Elsewhere</h3>
            <ul class="links">
              <li><a href="https://vercel.com/tes-bonnathyrak-s-projects/ocr-for-impaired-user/firewall" target="_blank" rel="noopener">Vercel firewall (requests it blocked)</a></li>
              <li><a href="https://vercel.com/tes-bonnathyrak-s-projects/ocr-for-impaired-user/logs" target="_blank" rel="noopener">Vercel logs (errors)</a></li>
              <li><a href="https://console.cloud.google.com/apis/api/vision.googleapis.com/metrics" target="_blank" rel="noopener">Google Vision usage</a></li>
              <li><a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener">Google billing</a></li>
            </ul>
          </section>
        </div>
      </main>
    </template>
  </div>
</template>

<style>
/* Admin-only tokens; chart series are the validated default categorical slots 1-2 */
.admin {
  color-scheme: light;
  --a-bg: #f4f6fa; --a-surface: #ffffff; --a-tip: #ffffff; --a-text: #0f172a; --a-text-2: #475569; --a-text-3: #64748b;
  --a-grid: #e2e8f0; --a-hover: rgba(15, 23, 42, 0.05); --a-link: #2459c7; --a-btn: #4466f6; --a-on-btn: #ffffff;
  --a-series-1: #2a78d6; --a-series-2: #eb6834;
  --a-good: #0ca30c; --a-good-text: #087208; --a-warning: #fab219; --a-warning-text: #8a5a00;
  --a-serious: #ec835a; --a-serious-text: #a8461c; --a-critical: #d03b3b; --a-critical-text: #b02a2a;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .admin {
    color-scheme: dark;
    --a-bg: #0f1115; --a-surface: #1a1a19; --a-tip: #26262a; --a-text: #f0efec; --a-text-2: #c3c2b7; --a-text-3: #9a998f;
    --a-grid: #2e2e2c; --a-hover: rgba(255, 255, 255, 0.06); --a-link: #8ab4ff; --a-btn: #6d8bff; --a-on-btn: #0b1020;
    --a-series-1: #3987e5; --a-series-2: #d95926;
    --a-good-text: #4cc94c; --a-warning-text: #fab219; --a-serious-text: #ec835a; --a-critical-text: #ef6b6b;
  }
}
:root[data-theme="dark"] .admin {
  color-scheme: dark;
  --a-bg: #0f1115; --a-surface: #1a1a19; --a-tip: #26262a; --a-text: #f0efec; --a-text-2: #c3c2b7; --a-text-3: #9a998f;
  --a-grid: #2e2e2c; --a-hover: rgba(255, 255, 255, 0.06); --a-link: #8ab4ff; --a-btn: #6d8bff; --a-on-btn: #0b1020;
  --a-series-1: #3987e5; --a-series-2: #d95926;
  --a-good-text: #4cc94c; --a-warning-text: #fab219; --a-serious-text: #ec835a; --a-critical-text: #ef6b6b;
}
body:has(.admin) { background: var(--a-bg, #f4f6fa); margin: 0; }
</style>

<style scoped>
.admin { min-height: 100vh; background: var(--a-bg); color: var(--a-text); font-family: 'SN Pro', 'Atkinson Hyperlegible', system-ui, sans-serif; font-size: 14px; }
/* The reader's global heading and paragraph colors must not leak in */
h1, h2, h3, p, dd, td, strong { color: var(--a-text); }
h1 { font-size: 18px; margin: 0; }
h2 { font-size: 16px; margin: 0 0 8px; }
h3 { font-size: 14px; margin: 16px 0 8px; }
p { margin: 0; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.muted, td.muted { color: var(--a-text-2); }
.small { font-size: 12px; margin-top: 8px; }
.card { background: var(--a-surface); border-radius: 12px; padding: 16px; }
.error { color: var(--a-critical-text); margin: 8px 0; }

.signin { display: grid; place-items: center; min-height: 100vh; padding: 16px; }
.signin-card { background: var(--a-surface); border-radius: 16px; padding: 28px; width: min(360px, 100%); display: grid; gap: 10px; }
.signin-card label { font-weight: 600; margin-top: 8px; }
.signin-card input { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--a-text-3); background: var(--a-bg); color: var(--a-text); }
.btn { font: inherit; font-weight: 600; padding: 10px 16px; border-radius: 999px; border: 0; background: var(--a-btn); color: var(--a-on-btn); cursor: pointer; min-height: 44px; }

.topbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: var(--a-surface); position: sticky; top: 0; z-index: 2; }
.brand { display: flex; align-items: center; gap: 10px; }
.top-actions { display: flex; align-items: center; gap: 4px; }
.icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 999px; background: none; color: var(--a-text); cursor: pointer; }
.icon-btn:hover { background: var(--a-hover); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.content { max-width: 1200px; margin: 0 auto; padding: 16px; display: grid; gap: 20px; }
.content > *, .charts > *, .two-col > * { min-width: 0; }
.section-title { margin-bottom: 10px; }

.hero-number { font-size: 15px; color: var(--a-text-2); margin: 4px 0 10px; }
.hero-number span { font-size: 36px; font-weight: 700; color: var(--a-text); font-variant-numeric: tabular-nums; margin-right: 4px; }
.meter { height: 10px; border-radius: 999px; background: var(--a-grid); overflow: hidden; max-width: 560px; }
.meter-fill { height: 100%; border-radius: 999px; }
.meter-fill.good { background: var(--a-series-1); }
.meter-fill.warning { background: var(--a-warning); }
.meter-fill.critical { background: var(--a-critical); }
.status-line { display: flex; align-items: center; gap: 6px; margin-top: 10px; font-weight: 600; }
.status-line.good, .good { color: var(--a-good-text); }
.status-line.warning, .warning { color: var(--a-warning-text); }
.status-line.critical, .critical { color: var(--a-critical-text); }

.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 12px; }
@media (max-width: 560px) { .tiles { grid-template-columns: 1fr 1fr; } }
.tile-label { color: var(--a-text-2) !important; font-size: 13px; }
.tile-value { font-size: 26px; font-weight: 700; margin: 4px 0; font-variant-numeric: tabular-nums; }
.tile-value.bad { color: var(--a-critical-text) !important; }
.tile-note { color: var(--a-text-3) !important; font-size: 12px; }

.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 12px; }

.recent-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.filters { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--a-grid); background: none; color: var(--a-text); cursor: pointer; min-height: 32px; }
.chip[aria-pressed="true"] { background: var(--a-btn); border-color: var(--a-btn); color: var(--a-on-btn); }
.table-wrap { overflow: auto; max-height: 460px; margin-top: 10px; }
table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--a-grid); vertical-align: top; }
th { color: var(--a-text-2); font-weight: 600; position: sticky; top: 0; background: var(--a-surface); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid currentColor; white-space: nowrap; }
.badge.good { color: var(--a-good-text); }
.badge.warning { color: var(--a-warning-text); }
.badge.serious { color: var(--a-serious-text); }
.badge.critical { color: var(--a-critical-text); }

.two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 12px; }
.checks { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.checks li { display: flex; gap: 10px; align-items: flex-start; }
.checks li svg { flex: none; margin-top: 1px; }
.checks strong { display: block; }
.checks span { color: var(--a-text-2); font-size: 13px; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; }
.facts dt { color: var(--a-text-2); }
.facts dd { margin: 0; overflow-wrap: anywhere; }
.links { padding-left: 18px; margin: 0; display: grid; gap: 6px; }
.links a { color: var(--a-link); }

@media (max-width: 560px) {
  .top-actions .muted { display: none; }
  .charts { grid-template-columns: 1fr; }
}
</style>
