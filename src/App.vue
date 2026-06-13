<script setup>
</script>

<template>
  <div class="web-app-wrapper">
    <router-view />
  </div>
</template>

<style>
.web-app-wrapper {
  width: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #f4f7f6 0%, #e2e8f0 100%);
  display: flex;
  flex-direction: column;
  color: #1e293b;
  font-family: var(--font-sans);
}

/* Base scrollbar styling for the whole app */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
