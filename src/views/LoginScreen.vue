<script setup>
import { useRouter } from 'vue-router'
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-vue-next'
import { t } from '../services/i18n'

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
        <h1 class="action-card-title khmer-font">{{ t('welcomeTitle') }}</h1>
        <p class="action-card-sub khmer-font">{{ t('welcomeSub') }}</p>
      </header>

      <!-- Key Accessibility Highlights -->
      <div class="welcome-features-list" role="list" aria-label="Key Features">
        <div class="welcome-feature-item khmer-font" role="listitem">
          <Zap :size="20" class="feature-icon text-accent" />
          <span>{{ t('featureInstant') }}</span>
        </div>
        <div class="welcome-feature-item khmer-font" role="listitem">
          <Sparkles :size="20" class="feature-icon text-accent" />
          <span>{{ t('featureKaraoke') }}</span>
        </div>
        <div class="welcome-feature-item khmer-font" role="listitem">
          <ShieldCheck :size="20" class="feature-icon text-accent" />
          <span>{{ t('featurePrivacy') }}</span>
        </div>
      </div>

      <!-- Primary 1-Tap Instant Assistant Button -->
      <div class="primary-try-now-block">
        <button 
          type="button" 
          class="btn btn-primary btn-try-now khmer-font"
          @click="handleStart"
          :aria-label="t('startInstantBtn')"
        >
          <span class="label-primary-action">{{ t('startInstantBtn') }}</span>
          <ArrowRight :size="24" />
        </button>
      </div>

      <!-- Footer reassurance note -->
      <p class="welcome-footer-note khmer-font">
        {{ t('welcomeFooter') }}
      </p>
    </div>
  </div>
</template>

<style scoped src="./LoginScreen.css"></style>
