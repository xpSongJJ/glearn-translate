import { defineContentScript } from 'wxt/utils/define-content-script';
import browser from 'webextension-polyfill';
import { watch } from 'vue';
import { config, configReady } from './utils/config';
import { cache } from './utils/cache';
import { mountSelectionTranslator, unmountSelectionTranslator } from './utils/selectionTranslator';
import { mountNewApiComponent, unmountNewApiComponent } from './utils/newApi';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_end',
    async main(ctx) {
        await configReady;
        // Keep watching even while disabled, so enabling takes effect without a reload.
        const stop = watch(
            () => [config.on, config.selectionTranslatorMode],
            () => {
                if (config.on && config.selectionTranslatorMode !== 'disabled') mountSelectionTranslator();
                else unmountSelectionTranslator();
            },
            { immediate: true },
        );
        mountNewApiComponent();
        cache.cleaner();
        const onMessage = (message: any) => {
            if (message.type === 'clearCache') {
                cache.clean();
                return Promise.resolve({ success: true });
            }
        };
        browser.runtime.onMessage.addListener(onMessage);
        ctx.onInvalidated(() => {
            stop();
            unmountSelectionTranslator();
            unmountNewApiComponent();
            browser.runtime.onMessage.removeListener(onMessage);
        });
    },
});
