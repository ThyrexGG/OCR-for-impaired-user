<script setup>
import { useRouter } from 'vue-router'
import { Sparkles, ScanText, Headphones, Eye, ArrowRight, ShieldCheck } from 'lucide-vue-next'

const router = useRouter()

const handleLogin = () => {
  // Navigate to main workspace
  router.push('/home')
}
</script>

<template>
  <div class="login-wrapper">
    <!-- Left Side: Features Showcase (Visible on Desktop/Tablet) -->
    <section class="login-features" aria-label="ការណែនាំពីកម្មវិធី (Feature Highlights)">
      <div class="features-content">
        <div class="features-header">
          <div class="brand-badge khmer-font">
            <Sparkles :size="16" class="text-accent" />
            <span>បច្ចេកវិទ្យាជំនួយការអានអក្សរខ្មែរ</span>
          </div>
          <h1 class="features-title">
            <span class="khmer-font title-khmer">ស្វាគមន៍មកកាន់</span>
            <span class="title-highlight">SONGKHEM</span>
          </h1>
          <p class="features-subtitle khmer-font">
            កម្មវិធីជំនួយការអានឯកសារខ្មែរជាសំឡេង សម្រាប់ជនពិការភ្នែក និងអ្នកមានបញ្ហាចុះខ្សោយគំហើញ។
          </p>
        </div>

        <div class="features-grid">
          <!-- Card 1: TTS -->
          <div class="feature-card">
            <div class="feature-icon-box bg-brand">
              <Headphones :size="28" />
            </div>
            <div class="feature-text">
              <h3 class="feature-title khmer-font">បម្លែងអត្ថបទទៅជាសំឡេង (TTS)</h3>
              <p class="feature-desc khmer-font">
                អានឯកសារជាសំឡេងភាសាខ្មែរធម្មជាតិ ជាមួយការរំលេចពាក្យម្តងមួយៗ (Karaoke Highlight)។
              </p>
            </div>
          </div>

          <!-- Card 2: OCR -->
          <div class="feature-card">
            <div class="feature-icon-box bg-accent">
              <ScanText :size="28" />
            </div>
            <div class="feature-text">
              <h3 class="feature-title khmer-font">ស្កេនឯកសារខ្មែរឆ្លាតវៃ (OCR)</h3>
              <p class="feature-desc khmer-font">
                ស្រង់អត្ថបទពីសន្លឹកឯកសារ រូបភាព និង PDF ដោយស្វ័យប្រវត្តិកម្រិតសុក្រឹតភាពខ្ពស់។
              </p>
            </div>
          </div>

          <!-- Card 3: Accessibility -->
          <div class="feature-card">
            <div class="feature-icon-box bg-emerald">
              <Eye :size="28" />
            </div>
            <div class="feature-text">
              <h3 class="feature-title khmer-font">រចនាឡើងសម្រាប់ភាពងាយស្រួល</h3>
              <p class="feature-desc khmer-font">
                គាំទ្រទម្រង់ពណ៌កម្រិតខ្ពស់ (High Contrast) ការពង្រីកអក្សរ និងសំឡេងជំនួយបញ្ជា UI។
              </p>
            </div>
          </div>
        </div>

        <!-- Accessible Trust Footer -->
        <div class="features-trust">
          <ShieldCheck :size="18" class="text-accent" />
          <span class="khmer-font">អនុលោមតាមបទដ្ឋានលទ្ធភាពប្រើប្រាស់ WCAG 2.2 AAA</span>
        </div>
      </div>
    </section>

    <!-- Right Side: Accessible Login Panel -->
    <section class="login-panel" aria-label="ទម្រង់ចូលប្រើប្រាស់ (Login Form)">
      <div class="login-box glass-card">
        <header class="login-header">
          <div class="logo-frame">
            <img :src="'/logo.png'" alt="SONGKHEM Logo" class="app-logo" />
          </div>
          <h2 class="login-title khmer-font">ចូលប្រើប្រាស់ប្រព័ន្ធ</h2>
          <p class="login-subtitle khmer-font">សូមស្វាគមន៍! ចូលដើម្បីចាប់ផ្តើមស្កេន និងអានឯកសារ។</p>
        </header>

        <!-- Quick Demo Access (One-click instant trial for users & evaluators) -->
        <div class="quick-access-section">
          <button 
            type="button" 
            class="btn btn-primary btn-demo-access khmer-font"
            @click="handleLogin"
            aria-label="ចូលសាកល្បងភ្លាមៗ ដោយមិនបាច់ចុះឈ្មោះ"
          >
            <span>ចូលសាកល្បងភ្លាមៗ (Instant Demo)</span>
            <ArrowRight :size="20" />
          </button>
        </div>

        <div class="divider-text khmer-font">
          <span>ឬចូលតាមរយៈ</span>
        </div>

        <!-- Social Login: Google -->
        <div class="social-login-single">
          <button 
            type="button" 
            class="btn btn-secondary btn-google" 
            @click="handleLogin"
            aria-label="បន្តចូលតាមរយៈ Google"
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

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="input-group">
            <label for="email" class="khmer-font">អ៊ីមែល (Email)</label>
            <input 
              type="email" 
              id="email" 
              placeholder="name@example.com" 
              autocomplete="email"
              required 
            />
          </div>

          <div class="input-group">
            <label for="password" class="khmer-font">ពាក្យសម្ងាត់ (Password)</label>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              autocomplete="current-password"
              required 
            />
          </div>

          <div class="form-options">
            <label class="remember-me khmer-font">
              <input type="checkbox" />
              <span>ចងចាំខ្ញុំ</span>
            </label>
            <a href="#" class="forgot-password khmer-font" @click.prevent="handleLogin">ភ្លេចលេខសម្ងាត់?</a>
          </div>

          <button type="submit" class="btn btn-secondary btn-submit khmer-font">
            ចូលគណនី (Log In)
          </button>
        </form>

        <p class="signup-text khmer-font">
          មិនទាន់មានគណនី? <a href="#" @click.prevent="handleLogin">ចុះឈ្មោះឥឡូវនេះ</a>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped src="./LoginScreen.css"></style>
