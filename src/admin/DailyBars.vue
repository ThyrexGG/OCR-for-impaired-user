<script setup>
/**
 * Bars per day for the admin panel: one bar per day, stacked when there is more than one series.
 * Hover (or focus) a day for its numbers; "Show as table" gives the same data as a table.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  days: { type: Array, required: true }, // [{ date: 'YYYY-MM-DD', ...counts }]
  series: { type: Array, required: true }, // [{ key, label, color }] bottom to top
})

const HEIGHT = 180
const PAD = { top: 12, right: 16, bottom: 24, left: 36 }
const GAP = 2 // surface gap between stacked segments

const box = ref(null)
const width = ref(600)
const hovered = ref(-1)
const asTable = ref(false)
let observer

onMounted(() => {
  observer = new ResizeObserver(([entry]) => (width.value = Math.max(280, entry.contentRect.width)))
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const value = (day, key) => Number(day[key]) || 0
const totals = computed(() => props.days.map((d) => props.series.reduce((sum, s) => sum + value(d, s.key), 0)))

// A rounded top for the axis: 1, 2 or 5 times a power of ten
const niceMax = computed(() => {
  const max = Math.max(4, ...totals.value)
  const step = 10 ** Math.floor(Math.log10(max))
  return [1, 2, 5, 10].map((m) => m * step).find((n) => n >= max)
})
// Whole-number gridlines: 4 or 5 steps when the top divides evenly, else halves
const ticks = computed(() => {
  const steps = [5, 4, 2].find((c) => niceMax.value % c === 0) || 1
  return Array.from({ length: steps + 1 }, (_, i) => (niceMax.value / steps) * i)
})

const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = HEIGHT - PAD.top - PAD.bottom
const slot = computed(() => plotW.value / Math.max(1, props.days.length))
const barW = computed(() => Math.max(3, Math.min(18, slot.value * 0.6)))
const y = (v) => PAD.top + plotH - (v / niceMax.value) * plotH

// Rounded only on the data end (top), square on the baseline
const roundedTop = (x, top, w, h) => {
  const r = Math.min(4, w / 2, h)
  return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`
}

const bars = computed(() =>
  props.days.map((day, i) => {
    const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2
    let base = 0
    const visible = props.series.filter((s) => value(day, s.key) > 0)
    const segments = visible.map((s, j) => {
      const v = value(day, s.key)
      const top = y(base + v)
      const bottom = y(base) - (j > 0 ? GAP : 0)
      base += v
      return { key: s.key, color: s.color, x, top, h: Math.max(1, bottom - top), last: j === visible.length - 1 }
    })
    return { day, i, segments, hitX: PAD.left + i * slot.value }
  })
)

const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const labelEvery = computed(() => Math.ceil(props.days.length / Math.max(2, Math.floor(plotW.value / 56))))

const tip = computed(() => {
  const bar = bars.value[hovered.value]
  if (!bar) return null
  const left = Math.min(Math.max(bar.hitX + slot.value / 2, 70), width.value - 70)
  return { left, day: bar.day, total: totals.value[bar.i] }
})
</script>

<template>
  <section class="chart-card" :aria-label="title">
    <header class="chart-head">
      <h3>{{ title }}</h3>
      <button type="button" class="link-btn" :aria-pressed="asTable" @click="asTable = !asTable">
        {{ asTable ? 'Show as chart' : 'Show as table' }}
      </button>
    </header>

    <ul v-if="series.length > 1" class="legend">
      <li v-for="s in series" :key="s.key"><span class="swatch" :style="{ background: s.color }"></span>{{ s.label }}</li>
    </ul>

    <div v-show="!asTable" ref="box" class="chart-box" @mouseleave="hovered = -1">
      <svg :width="width" :height="HEIGHT" role="img" :aria-label="`${title}, last ${days.length} days`">
        <g class="grid">
          <g v-for="t in ticks" :key="t">
            <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(t)" :y2="y(t)" />
            <text :x="PAD.left - 6" :y="y(t) + 4" text-anchor="end">{{ t }}</text>
          </g>
        </g>
        <g v-for="bar in bars" :key="bar.day.date">
          <template v-for="seg in bar.segments" :key="seg.key">
            <path v-if="seg.last" :d="roundedTop(seg.x, seg.top, barW, seg.h)" :fill="seg.color" />
            <rect v-else :x="seg.x" :y="seg.top" :width="barW" :height="seg.h" :fill="seg.color" />
          </template>
          <text
            v-if="bar.i % labelEvery === (days.length - 1) % labelEvery"
            class="x-label"
            :x="bar.i === days.length - 1 ? width - 2 : bar.hitX + slot / 2"
            :y="HEIGHT - 6"
            :text-anchor="bar.i === days.length - 1 ? 'end' : 'middle'"
          >{{ shortDate(bar.day.date) }}</text>
          <rect
            class="hit"
            :x="bar.hitX"
            :y="PAD.top"
            :width="slot"
            :height="plotH"
            :class="{ on: hovered === bar.i }"
            tabindex="0"
            :aria-label="`${shortDate(bar.day.date)}: ${series.map((s) => `${s.label} ${value(bar.day, s.key)}`).join(', ')}`"
            @mouseenter="hovered = bar.i"
            @focus="hovered = bar.i"
            @blur="hovered = -1"
          />
        </g>
      </svg>
      <div v-if="tip" class="tip" :style="{ left: `${tip.left}px` }" aria-hidden="true">
        <strong>{{ shortDate(tip.day.date) }}</strong>
        <div v-for="s in [...series].reverse()" :key="s.key" class="tip-row">
          <span class="swatch" :style="{ background: s.color }"></span>{{ s.label }}<b>{{ value(tip.day, s.key) }}</b>
        </div>
        <div v-if="series.length > 1" class="tip-row total">Total<b>{{ tip.total }}</b></div>
      </div>
    </div>

    <div v-if="asTable" class="table-wrap">
      <table>
        <thead>
          <tr><th>Day</th><th v-for="s in series" :key="s.key">{{ s.label }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in [...days].reverse()" :key="d.date">
            <td>{{ shortDate(d.date) }}</td>
            <td v-for="s in series" :key="s.key">{{ value(d, s.key) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.chart-card { background: var(--a-surface); border-radius: 12px; padding: 16px; min-width: 0; }
.chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
h3 { margin: 0; font-size: 15px; color: var(--a-text) !important; }
.legend { display: flex; gap: 16px; list-style: none; padding: 0; margin: 8px 0 4px; font-size: 13px; color: var(--a-text-2); }
.legend li { display: flex; align-items: center; gap: 6px; }
.swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }
.chart-box { position: relative; margin-top: 8px; overflow: hidden; }
svg { display: block; }
.grid line { stroke: var(--a-grid); stroke-width: 1; }
.grid text, .x-label { fill: var(--a-text-3); font-size: 11px; font-variant-numeric: tabular-nums; }
.hit { fill: transparent; cursor: default; outline: none; }
.hit.on { fill: var(--a-hover); }
.tip {
  position: absolute; top: 4px; transform: translateX(-50%); pointer-events: none;
  background: var(--a-tip); color: var(--a-text); border-radius: 8px; padding: 8px 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18); font-size: 12px; min-width: 120px;
}
.tip-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; color: var(--a-text-2); }
.tip-row b { margin-left: auto; color: var(--a-text); font-variant-numeric: tabular-nums; }
.tip-row.total { border-top: 1px solid var(--a-grid); padding-top: 4px; }
.link-btn { background: none; border: 0; color: var(--a-link); font: inherit; font-size: 13px; cursor: pointer; padding: 4px; }
.table-wrap { max-height: 280px; overflow: auto; margin-top: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--a-grid); color: var(--a-text) !important; font-variant-numeric: tabular-nums; }
th:first-child, td:first-child { text-align: left; }
th { color: var(--a-text-2); font-weight: 600; position: sticky; top: 0; background: var(--a-surface); }
</style>
