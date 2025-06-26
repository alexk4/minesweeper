import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)

const updateThemeColor = () => {
  const themeColor = window.matchMedia('(prefers-color-scheme: dark)').matches ? '#242424' : '#ffffff'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeColor)

updateThemeColor()

app.mount('#app')
