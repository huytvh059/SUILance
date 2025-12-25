import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // THÊM DÒNG NÀY: Tên repo của bạn nằm trong dấu gạch chéo
  base: "/SUILance/", 
})