<script setup>
import { useRouter } from 'vue-router'
import { Sparkles, Camera, Headphones, Eye, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-vue-next'

const router = useRouter()

const handleTryNow = () => {
  router.push('/home')
}
</script>

<template>
  <div class="welcome-page-wrapper">
    <!-- Left / Hero Side: Visual Assistant Purpose & Core Capabilities -->
    <section class="welcome-hero-panel" aria-label="ការណែនាំពីកម្មវិធី songKHEM">
      <div class="hero-inner-content">
        <!-- Brand Badge -->
        <div class="hero-brand-pill khmer-font">
          <Sparkles :size="16" class="text-accent" />
          <span>បច្ចេកវិទ្យាជំនួយការមើលឃើញសម្រាប់ប្រជាជនកម្ពុជា</span>
        </div>

        <h1 class="hero-main-title">
          <span class="khmer-font hero-khmer-welcome">ស្វាគមន៍មកកាន់</span>
          <span class="hero-brand-highlight">songKHEM</span>
        </h1>

        <p class="hero-tagline khmer-font">
          ជំនួយការមើលឃើញ និងអានឯកសារខ្មែរជាសំឡេង សម្រាប់ជនពិការភ្នែក និងអ្នកមានបញ្ហាចុះខ្សោយគំហើញ។
        </p>

        <!-- 3 Core Pillars -->
        <div class="pillars-list">
          <div class="pillar-card">
            <div class="pillar-icon-box bg-brand">
              <Camera :size="26" />
            </div>
            <div class="pillar-text">
              <h3 class="pillar-title khmer-font">ស្កេន និងយល់ដឹងភ្លាមៗ (Camera First)</h3>
              <p class="pillar-desc khmer-font">
                គ្រាន់តែតម្រង់ទូរស័ព្ទទៅកាន់ក្រដាស ឬវត្ថុ ប្រព័ន្ធនឹងណែនាំទីតាំង និងស្កេនអត្ថបទខ្មែរដោយស្វ័យប្រវត្តិ។
              </p>
            </div>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-box bg-accent">
              <Headphones :size="26" />
            </div>
            <div class="pillar-text">
              <h3 class="pillar-title khmer-font">អានជាសំឡេងខ្មែរធម្មជាតិ (Khmer Speech)</h3>
              <p class="pillar-desc khmer-font">
                បម្លែងអត្ថបទទៅជាសំឡេងភាសាខ្មែរពិរោះរលូន ជាមួយការរំលេចពាក្យម្តងមួយៗ (Karaoke Highlight)។
              </p>
            </div>
          </div>

          <div class="pillar-card">
            <div class="pillar-icon-box bg-emerald">
              <Eye :size="26" />
            </div>
            <div class="pillar-text">
              <h3 class="pillar-title khmer-font">ងាយស្រួលបំផុតសម្រាប់ភ្នែកខ្សោយ (WCAG AAA)</h3>
              <p class="pillar-desc khmer-font">
                កម្រិតពណ៌ខ្ពស់ពិសេស (Ultra Contrast) ពង្រីកអក្សរធំៗ និងសំឡេងជំនួយបញ្ជាគ្រប់ជំហាន។
              </p>
            </div>
          </div>
        </div>

        <!-- Trust badge -->
        <div class="trust-footer-badge khmer-font">
          <ShieldCheck :size="18" class="text-accent" />
          <span>អនុលោមតាមបទដ្ឋានលទ្ធភាពប្រើប្រាស់កម្រិតខ្ពស់ WCAG 2.2 AAA</span>
        </div>
      </div>
    </section>

    <!-- Right Side: Fast-Track Action & Sign In -->
    <section class="welcome-action-panel" aria-label="ទម្រង់ចូលប្រើប្រាស់">
      <div class="action-card-box glass-card">
        <header class="action-card-header">
          <div class="app-logo-gem">
            <img src="/logo.png" alt="songKHEM Logo" class="app-logo-img" />
          </div>
          <h2 class="action-card-title khmer-font">ចាប់ផ្តើមប្រើប្រាស់ songKHEM</h2>
          <p class="action-card-sub khmer-font">មិនចាំបាច់មានគណនីក៏អាចសាកល្បងបានភ្លាមៗ</p>
        </header>

        <!-- Primary Giant Try Now CTA Button -->
        <div class="primary-try-now-block">
          <button 
            type="button" 
            class="btn btn-primary btn-try-now khmer-font"
            @click="handleTryNow"
            aria-label="សាកល្បងប្រើភ្លាមៗ ដោយមិនបាច់ចុះឈ្មោះ"
          >
            <div class="try-btn-label">
              <span class="label-top">សាកល្បងប្រើភ្លាមៗ</span>
              <span class="label-sub">Start Instant Assistant</span>
            </div>
            <ArrowRight :size="24" />
          </button>
        </div>

        <div class="divider-line khmer-font">
          <span>ឬចូលគណនីដើម្បីរក្សាទុកទិន្នន័យ</span>
        </div>

        <!-- Optional Social & Email Login -->
        <div class="social-login-row">
          <button 
            type="button" 
            class="btn btn-secondary btn-google-social khmer-font" 
            @click="handleTryNow"
            aria-label="ចូលតាមរយៈ Google"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px" aria-hidden="true">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <form class="login-form-body" @submit.prevent="handleTryNow">
          <div class="input-block">
            <label for="login-email" class="khmer-font">អ៊ីមែល (Email)</label>
            <input type="email" id="login-email" placeholder="name@example.com" autocomplete="email" required />
          </div>

          <div class="input-block">
            <label for="login-password" class="khmer-font">ពាក្យសម្ងាត់ (Password)</label>
            <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password" required />
          </div>

          <button type="submit" class="btn btn-secondary btn-submit-login khmer-font">
            ចូលគណនី (Sign In)
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped src="./LoginScreen.css"></style>
