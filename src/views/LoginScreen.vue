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

<style scoped>
.login-wrapper {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background: white;
}

/* --- Left Side Features --- */
.login-features {
  display: none; /* hidden on mobile */
}

@media (min-width: 900px) {
  .login-features {
    display: flex;
    flex-direction: column;
    flex: 1;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: white;
    padding: 60px 40px;
    align-items: center;
    justify-content: center;
  }
}

@media (min-width: 1100px) {
  .login-features {
    padding: 60px 80px;
  }
}

.features-header {
  margin-bottom: 40px;
  width: 100%;
  max-width: 480px;
}

.features-title {
  font-size: 2.2rem;
  font-weight: 800;
  margin: 0 0 12px 0;
  color: white;
  line-height: 1.2;
}

.features-subtitle {
  font-size: 1.1rem;
  line-height: 1.5;
  color: #94a3b8;
  margin: 0;
}

.features-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 480px;
}

.theme-card {
  border-radius: 16px;
  padding: 20px;
  display: flex;
  transition: transform 0.3s ease;
}

.theme-card:hover {
  transform: translateX(8px);
}

.card-blue { background: linear-gradient(145deg, rgba(43,97,162,0.8), rgba(30,75,133,0.8)); border: 1px solid rgba(255,255,255,0.1); }
.card-teal { background: linear-gradient(145deg, rgba(13,148,136,0.8), rgba(15,118,110,0.8)); border: 1px solid rgba(255,255,255,0.1); }
.card-indigo { background: linear-gradient(145deg, rgba(99,102,241,0.8), rgba(79,70,229,0.8)); border: 1px solid rgba(255,255,255,0.1); }

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  padding: 14px;
  border-radius: 14px;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
}

.text-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.card-desc {
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

/* --- Right Side Login Panel --- */
.login-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: #ffffff;
}

@media (max-width: 480px) {
  .login-panel {
    padding: 16px 20px;
    height: 100vh;
    overflow: hidden; /* Guarantee no scroll on mobile */
  }
}

.login-box {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
}

@media (max-width: 480px) {
  .login-box {
    margin: auto 0; /* Center nicely in the no-scroll view */
  }
}

.login-header {
  margin-bottom: 32px;
  text-align: center;
}

.app-logo {
  width: 100%;
  max-width: 180px;
  height: auto;
  object-fit: contain;
}

@media (min-width: 480px) {
  .app-logo {
    max-width: 280px;
  }
}

.login-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.login-subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0 0 20px 0;
}

@media (min-width: 480px) {
  .login-title {
    font-size: 1.8rem;
  }
  .login-subtitle {
    font-size: 1rem;
    margin: 0 0 32px 0;
  }
}

.social-login-single {
  display: flex;
  margin-bottom: 20px;
}

.btn-social {
  width: 100%;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s ease;
}

.btn-social:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.divider-text {
  display: flex;
  align-items: center;
  text-align: center;
  margin-bottom: 20px;
}

.divider-text::before,
.divider-text::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}

.divider-text span {
  padding: 0 12px;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 500;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.input-group input {
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.95rem;
  color: #1e293b;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-group input:focus {
  outline: none;
  border-color: #2b61a2;
  box-shadow: 0 0 0 4px rgba(43, 97, 162, 0.1);
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
}

.forgot-password {
  font-size: 0.85rem;
  font-weight: 600;
  color: #2b61a2;
  text-decoration: none;
}

.forgot-password:hover {
  text-decoration: underline;
}

.btn-login {
  margin-top: 4px;
  background: linear-gradient(145deg, #f97316, #ea580c);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.3);
  transition: all 0.3s ease;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(249, 115, 22, 0.4);
}

.signup-text {
  margin-top: 20px;
  text-align: center;
  font-size: 0.9rem;
  color: #64748b;
}

.signup-text a {
  font-weight: 700;
  color: #2b61a2;
  text-decoration: none;
}

.signup-text a:hover {
  text-decoration: underline;
}
</style>
