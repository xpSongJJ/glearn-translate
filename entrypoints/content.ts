import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { configReady } from './utils/config';
import { cache } from './utils/cache';
import { mountSelectionTranslator, unmountSelectionTranslator } from './utils/selectionTranslator';
import { mountNewApiComponent, unmountNewApiComponent } from './utils/newApi';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_end',
    async main(ctx) {
        await configReady;
        mountSelectionTranslator();
        mountNewApiComponent();
        cache.cleaner();
        const onMessage = (message: any, _sender: unknown, sendResponse: (value: unknown) => void) => {
            if (message.type === 'clearCache') {
                cache.clean();
                sendResponse({ success: true });
            }
        };
        browser.runtime.onMessage.addListener(onMessage);
        ctx.onInvalidated(() => {
            unmountSelectionTranslator();
            unmountNewApiComponent();
            browser.runtime.onMessage.removeListener(onMessage);
        });
    },
});
