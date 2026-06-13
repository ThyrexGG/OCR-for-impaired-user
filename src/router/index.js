import { createRouter, createWebHistory } from 'vue-router'
import LoginScreen from '../views/LoginScreen.vue'
import HomeScreen from '../views/HomeScreen.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginScreen
    },
    {
      path: '/home',
      name: 'home',
      component: HomeScreen
    }
  ]
})

export default router
