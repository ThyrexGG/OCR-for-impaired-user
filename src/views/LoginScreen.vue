<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const handleLogin = () => {
  // In a real app, this would authenticate the user
  router.push('/home')
}
</script>

<template>
  <div class="login-wrapper">
    <!-- Left Side: Features Showcase (Visible on Desktop) -->
    <div class="login-features">
      <div class="features-header">
        <h2 class="features-title">Welcome to SONGKHEM</h2>
        <p class="features-subtitle">Empowering accessibility through advanced Khmer OCR and Text-to-Speech technology.</p>
      </div>
      
      <div class="features-grid">
        <!-- Card 1 -->
        <div class="theme-card card-blue">
          <div class="card-content">
            <div class="icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
            </div>
            <div class="text-container">
              <h3 class="card-title">Convert Text to Sound</h3>
              <p class="card-desc">Read any document and turn it into Khmer language audio for people with Visual Impairment.</p>
            </div>
          </div>
        </div>
        
        <!-- Card 2 -->
        <div class="theme-card card-teal">
          <div class="card-content">
            <div class="icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            </div>
            <div class="text-container">
              <h3 class="card-title">Smart Document Scanning</h3>
              <p class="card-desc">Extract Khmer text from images and PDFs with high accuracy using advanced OCR technology.</p>
            </div>
          </div>
        </div>

        <!-- Card 3 -->
        <div class="theme-card card-indigo">
          <div class="card-content">
            <div class="icon-container">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 16 4-5-4-5-4 5z"/><path d="M12 18v.01"/></svg>
            </div>
            <div class="text-container">
              <h3 class="card-title">Fast & Accessible</h3>
              <p class="card-desc">Designed to be user-friendly, providing instant translation to sound for everyone.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side: Login Panel -->
    <div class="login-panel">
      <div class="login-box">
        <header class="login-header">
          <img :src="'/logo.png'" alt="SONGKHEM Logo" class="app-logo" />
        </header>

        <h1 class="login-title">Log in to your account</h1>
        <p class="login-subtitle">Welcome back! Please enter your details.</p>

        <!-- Social Logins (Google Only) -->
        <div class="social-login-single">
          <button class="btn-social btn-google" @click="handleLogin">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Continue with Google
          </button>
        </div>

        <div class="divider-text">
          <span>Or log in with email</span>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" placeholder="Enter your email" required />
          </div>
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password" required />
          </div>
          <div class="form-options">
            <label class="remember-me">
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" class="forgot-password">Forgot password?</a>
          </div>

          <button type="submit" class="btn-login">
            Log In
          </button>
        </form>

        <p class="signup-text">
          Don't have an account? <a href="#">Sign up</a>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped src="./LoginScreen.css"></style>
