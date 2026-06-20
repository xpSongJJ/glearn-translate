<template>
  <teleport to="body">
    <div ref="selection-ref" class="fr-selection-translator-wrapper">
      <!-- 小红点指示器 -->
      <div v-if="showIndicator" 
          class="fr-selection-indicator" 
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave">
      </div>
    
      <!-- 翻译结果弹窗 -->
      <div v-if="showTooltip" 
          class="fr-translation-tooltip" 
          :class="{ 'fr-dark-theme': isDarkTheme }"
          @mouseenter="handleMouseEnterTooltip"
          @mouseleave="handleMouseLeaveTooltip">
        <div class="fr-tooltip-header">
          <span>翻译结果<small>（{{ serviceLabel }}）</small></span>
          <div class="fr-tooltip-actions">
            <button class="fr-action-btn" @click="copyTranslation" title="复制译文">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="fr-close-btn" @click="closeTooltip">×</button>
          </div>
        </div>
        <div class="fr-tooltip-content">
          <!-- 原文尽早显示（双语模式），不受加载状态影响 -->
          <div v-if="config.selectionTranslatorMode === 'bilingual'" class="fr-original-text fr-no-select">
            <pre>{{ selectedText }}</pre>
          </div>
          <!-- 译文区域：加载 / 错误 / 结果 -->
          <div v-if="isLoading && !translationResult" :class="['fr-loading-spinner', { 'fr-static': !config.animations }]"></div>
          <div v-else-if="error" class="fr-error-message">{{ error }}</div>
          <div v-else-if="config.selectionTranslatorMode === 'bilingual' || config.selectionTranslatorMode === 'translation-only'" class="fr-translation-result fr-no-select">
            <pre>{{ translationResult }}</pre>
          </div>
          <!-- 首token延迟计时 -->
          <div v-if="firstTokenDelay >= 0" class="fr-first-token-delay">
            首token: {{ firstTokenDelay }}ms
            <div v-if="timingDetail" class="fr-timing-breakdown">{{ timingDetail }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 复制成功提示 -->
    <div v-if="copySuccess" class="fr-copy-success-toast" :class="{ 'fr-dark-theme': isDarkTheme }">
      <div class="fr-copy-success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <span>复制译文成功!</span>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, useTemplateRef, watchEffect } from 'vue';
import { translateText, translateTextStream, type StreamTiming } from '@/entrypoints/utils/translateApi';
import { config } from '@/entrypoints/utils/config';
import { services } from '@/entrypoints/utils/option';
import { autoPlacement, autoUpdate, computePosition, flip, hide, inline, offset, shift } from '@floating-ui/dom';

// 状态变量
const selectedText = ref('');
const translationResult = ref('');
const selectRange = ref<Range | null>(null);
const showIndicator = ref(false);
const showTooltip = ref(false);
const isLoading = ref(false);
const error = ref('');
const hideTooltipTimer = ref<number | null>(null);
const isHoveringTooltip = ref(false);
const copySuccess = ref(false);
const lastSelectedText = ref(''); // 用于存储上一次选择的文本
const isSelecting = ref(false); // 标记用户是否正在选择文本中
const debounceTimer = ref<number | null>(null); // 防抖定时器
const isFirefox = ref(false); // 是否为Firefox浏览器
const isDarkTheme = ref(false); // 主题状态
const firstTokenDelay = ref(-1); // 首token延迟（ms），-1 表示尚未测量
const timingDetail = ref(''); // 首token各阶段耗时明细

const containerRef = useTemplateRef('selection-ref');

// 翻译服务 → 显示名称映射
const serviceLabel = computed(() => {
  const labels: Record<string, string> = {
    [services.microsoft]: '微软翻译',
    [services.google]: '谷歌翻译',
    [services.deepL]: 'DeepL',
    [services.deeplx]: 'DeepLX',
    [services.xiaoniu]: '小牛翻译',
    [services.youdao]: '有道翻译',
    [services.tencent]: '腾讯云翻译',
    [services.chromeTranslator]: 'Chrome内置AI翻译',
    [services.siliconCloud]: '硅基流动',
    [services.huanYuan]: '腾讯混元',
    [services.huanYuanTranslation]: '腾讯混元翻译',
    [services.newapi]: 'New API',
    [services.deepseek]: 'DeepSeek',
    [services.openai]: 'OpenAI',
    [services.azureOpenai]: 'Azure OpenAI',
    [services.qwen]: '千问',
    [services.doubao]: '字节豆包',
    [services.grok]: 'Grok',
    [services.openrouter]: 'OpenRouter',
    [services.groq]: 'Groq',
    [services.moonshot]: 'Kimi',
    [services.zhipu]: '智谱清言',
    [services.baichuan]: '百川智能',
    [services.lingyi]: '零一万物',
    [services.minimax]: 'MiniMax',
    [services.jieyue]: '阶跃星辰',
    [services.infini]: '无向芯穹',
    [services.cozecom]: 'Coze国际',
    [services.cozecn]: 'Coze国内',
    [services.claude]: 'Claude',
    [services.gemini]: 'Gemini',
    [services.yiyan]: '文心一言',
    [services.custom]: '自定义接口',
  };
  return labels[config.service] || config.service;
});

// 自动更新小红点位置
watchEffect((onClean) => {
  const isPositioningActive = showIndicator.value || showTooltip.value;
  const range = selectRange.value;
  const container = containerRef.value;
  if (!isPositioningActive || !range || !container) return;

  const updatePosition = () => {
    computePosition(range, container, {
      placement: 'right',
      strategy: 'fixed',
      middleware: [offset(2), flip({fallbackPlacements: ['left', 'right', 'top-start', 'top-end', 'bottom-start', 'bottom-end'], padding: {top: 100, bottom: 100} }), shift(), hide(), inline()],
    }).then(({ x, y, placement, middlewareData }) => {
      Object.assign(container.style, {
        left: `${x}px`,
        top: `${y}px`,
        visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible',
      });
      container.setAttribute('data-placement', placement);
    })
  }

  const cb = autoUpdate(range, container, updatePosition, {
    animationFrame: true,
  });

  onClean(cb);
});

watch([showIndicator, showTooltip], ([isIndicatorVisible, isTooltipVisible]) => {
  if (isIndicatorVisible || isTooltipVisible) return;

  selectRange.value = null;
});

// 防抖函数
const debounce = (fn: Function, delay: number) => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
  }
  debounceTimer.value = window.setTimeout(() => {
    fn();
    debounceTimer.value = null;
  }, delay);
};

// 处理文本选择事件 (使用防抖优化)
const handleTextSelection = () => {
  // 如果用户正在选择中，不立即处理
  if (isSelecting.value) return;
  
  debounce(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      hideIndicator();
      return;
    }
    
    const selectedTextContent = selection.toString().trim();
    
    // 如果选中的文本为空，则不处理
    if (!selectedTextContent) {
      return;
    }
    
    // 如果选中的文本与上次相同，重新显示指示器（避免因为相同文本而不显示的问题）
    if (selectedTextContent === lastSelectedText.value) {
      // 重新显示指示器，但不重新获取翻译
      const range = selection.getRangeAt(0);
      selectRange.value = range;
      showIndicator.value = true;
      return;
    }
    
    // 忽略过短的选择（避免意外触发）
    if (selectedTextContent.length < 2) {
      hideIndicator();
      return;
    }
    
    // 忽略过长的选择（避免处理大段文本导致性能问题）
    const maxTextLength = 4096; // 设置最大字符数限制
    if (selectedTextContent.length > maxTextLength) {
      hideIndicator();
      return;
    }
    
    // 获取选中文本位置信息
    const range = selection.getRangeAt(0);
    
    // 保存选中文本和位置
    selectedText.value = selectedTextContent;
    lastSelectedText.value = selectedTextContent;
    selectRange.value = range;
    showIndicator.value = true;
  }, 200); // 200ms防抖延迟，减少延迟提高响应性
};

// 鼠标进入指示器
const handleMouseEnter = () => {
  clearHideTooltipTimer();
  showTooltip.value = true;
};

// 鼠标离开指示器
const handleMouseLeave = () => {
  // 如果鼠标不在tooltip上，则设置定时器隐藏tooltip
  if (!isHoveringTooltip.value) {
    setHideTooltipTimer();
  }
};

// 鼠标进入弹窗
const handleMouseEnterTooltip = () => {
  isHoveringTooltip.value = true;
  clearHideTooltipTimer();
};

// 鼠标离开弹窗
const handleMouseLeaveTooltip = () => {
  isHoveringTooltip.value = false;
  
  setHideTooltipTimer();
};

// 设置隐藏弹窗的定时器
const setHideTooltipTimer = () => {
  clearHideTooltipTimer();
  hideTooltipTimer.value = window.setTimeout(() => {
    showTooltip.value = false;
  }, 250); // 250毫秒后隐藏
};

// 清除隐藏弹窗的定时器
const clearHideTooltipTimer = () => {
  if (hideTooltipTimer.value !== null) {
    clearTimeout(hideTooltipTimer.value);
    hideTooltipTimer.value = null;
  }
};

// 隐藏指示器
const hideIndicator = () => {
  showIndicator.value = false;
  setHideTooltipTimer();
};

// 关闭翻译弹窗
const closeTooltip = () => {
  showTooltip.value = false;
};

// 获取翻译结果
const getTranslation = async () => {
  if (!selectedText.value) return;
  
  isLoading.value = true;
  error.value = '';
  translationResult.value = ''; // 清空旧结果，准备流式接收
  firstTokenDelay.value = -1;   // 重置首token计时
  timingDetail.value = '';      // 重置耗时明细
  const translateStartTime = performance.now();
  
  // 阶段耗时记录对象
  const st: StreamTiming = { entry: translateStartTime, afterSync: 0, readyRcvd: 0, requestSent: 0, firstReasoning: 0, firstChunk: 0 };
  
  try {
    const result = await translateTextStream(selectedText.value, document.title, (chunk) => {
      // 首token计时：收到第一个chunk时记录延迟
      if (firstTokenDelay.value < 0) {
        firstTokenDelay.value = Math.round(performance.now() - translateStartTime);
        // 计算各阶段耗时
        const preprocess = Math.round(st.afterSync - st.entry);
        const portConnect = Math.round((st.readyRcvd || performance.now()) - st.afterSync);
        const handshake = Math.round((st.requestSent || performance.now()) - (st.readyRcvd || st.afterSync));
        const thinking = st.firstReasoning ? Math.round(st.firstChunk - st.firstReasoning) : 0;
        const apiWait = Math.round((st.firstChunk || performance.now()) - (st.requestSent || st.afterSync));
        const thinkPart = thinking ? ` | 思考:${thinking}ms` : '';
        timingDetail.value = `sync:${preprocess}ms | port:${portConnect}ms | shake:${handshake}ms | API:${apiWait}ms${thinkPart}`;
      }
      // 流式追加：每收到一个文本块立即显示
      translationResult.value += chunk;
    }, st);
    // 流式完成后确保最终结果
    translationResult.value = result;
  } catch (err) {
    console.warn('Streaming translation failed, falling back to non-streaming:', err);
    try {
      // 流式失败时回退到原有非流式路径
      const result = await translateText(selectedText.value);
      translationResult.value = result;
      error.value = '';
    } catch (fallbackErr) {
      const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      error.value = errMsg || '翻译失败，请重试';
      console.error('Fallback translation error:', fallbackErr);
    }
  } finally {
    isLoading.value = false;
  }
};

// 复制翻译文本
const copyTranslation = () => {
  if (!translationResult.value) return;
  
  // 使用navigator.clipboard API复制文本
  navigator.clipboard.writeText(translationResult.value)
    .then(() => {
      // 显示复制成功消息
      copySuccess.value = true;
      // 1.5秒后隐藏消息
      setTimeout(() => {
        copySuccess.value = false;
      }, 1500);
    })
    .catch(err => {
      console.error('复制失败:', err);
    });
};

const detectFirefox = () => {
  return navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
};

// 获取当前主题状态
const getCurrentTheme = () => {
  const currentTheme = config.theme || 'auto';
  if (currentTheme === 'auto') {
    // 自动模式下检测系统主题
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return currentTheme === 'dark';
};

// 更新主题状态
const updateTheme = () => {
  isDarkTheme.value = getCurrentTheme();
};

// 监听事件
onMounted(() => {
  // 检测浏览器类型
  isFirefox.value = detectFirefox();
  
  // 初始化主题状态
  updateTheme();
  
  // 监听主题变化
  watch(() => config.theme, updateTheme, { immediate: true });
  
  // 监听系统主题变化（用于自动模式）
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (config.theme === 'auto') {
      updateTheme();
    }
  };
  darkModeMediaQuery.addEventListener('change', handleSystemThemeChange);
  
  // 保存系统主题监听器引用供清理使用
  systemThemeHandler = handleSystemThemeChange;
  
  // 定义事件监听器函数
  mouseDownHandler = () => {
    isSelecting.value = true;
  };
  
  mouseUpHandler = () => {
    isSelecting.value = false;
    handleTextSelection();
  };
  
  // 鼠标按下时，标记开始选择
  document.addEventListener('mousedown', mouseDownHandler);
  
  // 鼠标抬起时，标记选择结束，并处理选中文本
  document.addEventListener('mouseup', mouseUpHandler);
  
  // 添加selectionchange事件作为备用机制（使用节流限制频率）
  let lastSelectionChangeTime = 0;
  selectionChangeHandler = () => {
    const now = Date.now();
    // 节流：只有在500ms内没有处理过selectionchange且不在选择过程中时才处理
    if (now - lastSelectionChangeTime > 500 && !isSelecting.value) {
      lastSelectionChangeTime = now;
      // 延迟处理，确保选择操作完成
      setTimeout(() => {
        if (!isSelecting.value) {
          handleTextSelection();
        }
      }, 100);
    }
  };
  
  document.addEventListener('selectionchange', selectionChangeHandler);
  
  // 更新clickHandler定义，添加selectionchange的清理
  const originalClickHandler = clickHandler;
  clickHandler = (e: Event) => {
    originalClickHandler(e);
  };
  
  // 监听翻译显示状态的变化
  watch(showTooltip, async (newValue: boolean) => {
    if (newValue) {
      // 当显示弹窗时，加载翻译结果
      await getTranslation();
    }
  });
  
  // 定义点击事件处理函数
  clickHandler = (e: Event) => {
    // 检查点击事件是否发生在指示器或弹窗之外
    const target = e.target as HTMLElement;
    const isOutsideIndicator = !target.closest('.fr-selection-indicator');
    const isOutsideTooltip = !target.closest('.fr-translation-tooltip');
    
    if (isOutsideIndicator && isOutsideTooltip && showIndicator.value) {
      hideIndicator();
      closeTooltip();
    }
  };
  
  // 添加点击页面其他区域时隐藏指示器和弹窗
  document.addEventListener('click', clickHandler);
});

// 存储事件监听器函数的引用，用于正确移除
let mouseDownHandler: () => void;
let mouseUpHandler: () => void;
let clickHandler: (e: Event) => void;
let selectionChangeHandler: () => void;
let systemThemeHandler: () => void;

// 清理事件监听 (修复清理逻辑)
onBeforeUnmount(() => {
  // 正确移除事件监听器
  if (mouseDownHandler) {
    document.removeEventListener('mousedown', mouseDownHandler);
  }
  if (mouseUpHandler) {
    document.removeEventListener('mouseup', mouseUpHandler);
  }
  if (clickHandler) {
    document.removeEventListener('click', clickHandler);
  }
  if (selectionChangeHandler) {
    document.removeEventListener('selectionchange', selectionChangeHandler);
  }
  
  // 移除系统主题监听器
  if (systemThemeHandler) {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.removeEventListener('change', systemThemeHandler);
  }
  
  // 清理所有定时器
  clearHideTooltipTimer();
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
    debounceTimer.value = null;
  }
});
</script>

<style scoped>
.fr-selection-translator-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9998;
  width: 350px;
}

.fr-selection-indicator {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #ff4d4f;
  border-radius: 50%;
  cursor: pointer;
  z-index: 9999;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
  animation: pulse 1.5s infinite;
}

[data-placement="left"] .fr-selection-indicator {
  bottom: 0;
  right: 4px;
}
[data-placement="right"] .fr-selection-indicator {
  bottom: 0;
  left: 4px;
}
[data-placement="top-start"] .fr-selection-indicator {
  left: 0;
  bottom: 4px;
}
[data-placement="top-end"] .fr-selection-indicator {
  right: 0;
  bottom: 4px;
}
[data-placement="bottom-start"] .fr-selection-indicator {
  left: 0;
  top: 4px;
}
[data-placement="bottom-end"] .fr-selection-indicator {
  right: 0;
  top: 4px;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 10px rgba(255, 77, 79, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 77, 79, 0);
  }
}

.fr-translation-tooltip {
  position: absolute;
  background-color: white !important;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  width: 350px; /* 增加宽度 */
  transition: opacity 0.2s ease;
}

[data-placement="left"] .fr-translation-tooltip {
  top: -10px;
  right: 5px;
}
[data-placement="right"] .fr-translation-tooltip {
  top: -10px;
  left: 5px;
}
[data-placement="top-start"] .fr-translation-tooltip {
  left: 1px;
  bottom: 5px;
}
[data-placement="top-end"] .fr-translation-tooltip {
  right: 1px;
  bottom: 5px;
}
[data-placement="bottom-start"] .fr-translation-tooltip {
  left: 1px;
  top: 5px;
}
[data-placement="bottom-end"] .fr-translation-tooltip {
  right: 1px;
  top: 5px;
}

.fr-tooltip-header {
  padding: 8px 12px;
  background-color: #f5f5f5 !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e8e8e8;
  position: sticky; /* 使header粘性定位 */
  top: 0;
  z-index: 1;
}

.fr-tooltip-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.fr-action-btn, .fr-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.fr-action-btn:hover, .fr-copy-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.fr-close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 0;
  margin: 0;
  line-height: 1;
}

.fr-close-btn:hover {
  color: #666;
}

.fr-tooltip-content {
  padding: 12px;
  background-color: white !important;
  overflow-y: auto; /* 添加垂直滚动 */
  max-height: 350px; /* 增加最大高度 */
  scrollbar-width: thin; /* 细滚动条 */
  scrollbar-color: rgba(0, 0, 0, 0.3) transparent;
}

.fr-original-text pre,
.fr-translation-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  font-size: inherit;
  color: inherit !important;
}

.fr-original-text {
  margin-bottom: 8px;
  color: #666 !important;
  font-size: 14px;
  word-break: break-word;
  padding-bottom: 8px;
  border-bottom: 1px dashed #eee;
  position: relative;
}

.fr-translation-result {
  color: #333 !important;
  font-size: 15px;
  font-weight: 500;
  word-break: break-word;
  margin-top: 8px;
  line-height: 1.5;
  position: relative;
}

.fr-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  margin: 10px auto;
  animation: spin 1s linear infinite;
}

.fr-translation-tooltip.fr-dark-theme .fr-loading-spinner {
  border: 2px solid #444;
  border-top: 2px solid #69c0ff;
}

/* 静态加载样式 */
.fr-loading-spinner.fr-static {
  animation: none;
  background: radial-gradient(circle, rgb(230, 151, 171) 30%, rgba(230, 151, 171, 0.6) 70%);
  border: 2px solid rgb(200, 121, 141);
  box-shadow: 0 0 10px rgba(230, 151, 171, 0.5);
  position: relative;
}

/* 添加光泽效果 */
.fr-loading-spinner.fr-static::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  bottom: 2px;
  background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.1) 100%);
  border-radius: 50%;
  pointer-events: none;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.fr-error-message {
  color: #ff4d4f;
  text-align: center;
  padding: 10px;
}

.fr-translation-tooltip.fr-dark-theme .fr-error-message {
  color: #ff7875;
}

.fr-tooltip-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.fr-tooltip-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.fr-tooltip-content::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 暗黑模式适配 */
.fr-translation-tooltip.fr-dark-theme {
  background-color: #1f1f1f !important;
  border: 1px solid #333;
  color: #ffffff;
}

.fr-translation-tooltip.fr-dark-theme .fr-tooltip-header {
  background-color: #2a2a2a !important;
  border-bottom: 1px solid #444;
  color: #ffffff;
}

.fr-translation-tooltip.fr-dark-theme .fr-tooltip-header span {
  color: #ffffff;
}

.fr-translation-tooltip.fr-dark-theme .fr-original-text {
  color: #ffffff !important;
}

.fr-translation-tooltip.fr-dark-theme .fr-original-text pre {
  color: #ffffff !important;
}

.fr-translation-tooltip.fr-dark-theme .fr-translation-result {
  color: #ffffff !important;
}

.fr-translation-tooltip.fr-dark-theme .fr-translation-result pre {
  color: #ffffff !important;
}

.fr-translation-tooltip.fr-dark-theme .fr-close-btn {
  color: #bbb;
}

.fr-translation-tooltip.fr-dark-theme .fr-close-btn:hover {
  color: #ffffff;
}

.fr-translation-tooltip.fr-dark-theme .fr-tooltip-content {
  background-color: #1f1f1f !important;
}

.fr-translation-tooltip.fr-dark-theme .fr-tooltip-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
}

.fr-translation-container {
  position: relative;
}

.fr-no-select {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  cursor: default;
}

/* 首token延迟显示 */
.fr-first-token-delay {
  text-align: right;
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
  user-select: none;
}

.fr-timing-breakdown {
  font-size: 10px;
  color: #ccc;
  margin-top: 2px;
  font-family: monospace;
}

.fr-translation-tooltip.fr-dark-theme .fr-first-token-delay {
  color: #666;
}

.fr-translation-tooltip.fr-dark-theme .fr-timing-breakdown {
  color: #555;
}

/* 移除不需要的选择样式 */
.user-select-text::selection {
  background-color: #409eff;
  color: white;
}

.fr-translation-result, .fr-original-text {
  padding: 8px;
  border-radius: 4px;
  background: transparent;
  transition: background-color 0.15s ease;
}

.fr-translation-result:hover, .fr-original-text:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.fr-translation-tooltip.fr-dark-theme .fr-translation-result:hover, 
.fr-translation-tooltip.fr-dark-theme .fr-original-text:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.fr-copy-success-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10010;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  animation: toast-fade 1.5s ease forwards;
}

.fr-copy-success-icon {
  color: #52c41a;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes toast-fade {
  0% { opacity: 0; transform: translate(-50%, -40%); }
  20% { opacity: 1; transform: translate(-50%, -50%); }
  80% { opacity: 1; transform: translate(-50%, -50%); }
  100% { opacity: 0; transform: translate(-50%, -60%); }
}

.fr-copy-success-toast.fr-dark-theme {
  background-color: rgba(0, 0, 0, 0.85);
}

.fr-copy-success-toast.fr-dark-theme .fr-copy-success-icon {
  color: #73d13d;
}

.fr-translation-tooltip.fr-dark-theme .fr-action-btn,
.fr-translation-tooltip.fr-dark-theme .fr-copy-btn {
  color: #ffffff;
}

.fr-translation-tooltip.fr-dark-theme .fr-action-btn:hover,
.fr-translation-tooltip.fr-dark-theme .fr-copy-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

</style> 
