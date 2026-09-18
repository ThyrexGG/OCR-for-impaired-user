<script setup>
import { useRouter } from 'vue-router'
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-vue-next'

const router = useRouter()

const handleStart = () => {
  router.push('/home')
}
</script>

<template>
  <div class="welcome-page-wrapper">
    <div class="action-card-box glass-card">
      <header class="action-card-header">
        <div class="app-logo-gem">
          <img src="/logo.png" alt="songKHEM Logo" class="app-logo-img" />
        </div>
        <h1 class="action-card-title khmer-font">songKHEM</h1>
        <p class="action-card-sub khmer-font">ជំនួយការមើលឃើញ និងអានឯកសារជាសំឡេង (Assistive OCR & Reading Companion)</p>
      </header>

      <!-- Key Accessibility Highlights -->
      <div class="welcome-features-list" role="list" aria-label="លក្ខណៈពិសេសចម្បង">
        <div class="welcome-feature-item khmer-font" role="listitem">
          <Zap :size="18" class="feature-icon text-accent" />
          <span>ស្កេន និងអានជាសំឡេងភ្លាមៗ (Instant OCR & TTS)</span>
        </div>
        <div class="welcome-feature-item khmer-font" role="listitem">
          <Sparkles :size="18" class="feature-icon text-accent" />
          <span>រំលេចពាក្យពេលអាន (Karaoke Highlighting)</span>
        </div>
        <div class="welcome-feature-item khmer-font" role="listitem">
          <ShieldCheck :size="18" class="feature-icon text-accent" />
          <span>ឥតគិតថ្លៃ និងមិនបាច់ចុះឈ្មោះ (Free & No Sign-In)</span>
        </div>
      </div>

      <!-- Primary 1-Tap Instant Assistant Button -->
      <!-- Note: Backend auth (OAuth/Email) can be integrated here when real user accounts are supported. -->
      <div class="primary-try-now-block">
        <button 
          type="button" 
          class="btn btn-primary btn-try-now khmer-font"
          @click="handleStart"
          aria-label="ចាប់ផ្តើមប្រើប្រាស់ភ្លាមៗ ដោយមិនបាច់ចុះឈ្មោះ (Start Instant Assistant)"
        >
          <div class="try-btn-label">
            <span class="label-top">ចាប់ផ្តើមប្រើភ្លាមៗ</span>
            <span class="label-sub">Start Instant Assistant</span>
          </div>
          <ArrowRight :size="24" />
        </button>
      </div>

      <!-- Footer reassurance note -->
      <p class="welcome-footer-note khmer-font">
        រចនាឡើងសម្រាប់អ្នកមានពិការភាពគំហើញ និងភាសាខ្មែរ (Designed for low-vision users)
      </p>
    </div>
  </div>
</template>

<style scoped src="./LoginScreen.css"></style>
