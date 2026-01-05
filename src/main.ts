import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import i18n from './i18n'

const app = createApp(App)
app.use(Antd)
app.use(i18n)
app.mount('#app')
