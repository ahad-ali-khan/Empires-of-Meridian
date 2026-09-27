import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testIgnore:'**/sim/**',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:4173'},webServer:{command:'pnpm exec vite apps/web --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173',reuseExistingServer:true}});
