import {defineConfig, type WxtViteConfig} from 'wxt';
import vue from '@vitejs/plugin-vue';
import {resolve} from 'path';
import fs from 'fs';


const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));


// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/webextension-polyfill'],
    imports: {
        addons: {
            vueTemplate: true,
        },
    },
    vite: () => ({
        // WXT and the direct Vite dependency resolve different Vite 5 patch types.
        plugins: [vue()] as unknown as WxtViteConfig['plugins'],
        define: {
            'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
        }
    }),
    manifest: {
        permissions: ['storage'],
    },

});