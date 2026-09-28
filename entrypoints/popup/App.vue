<template>
  <div class="popup-shell">
    <main class="popup-content"><Main/></main>
    <footer class="footer-bar"><Footer/></footer>
  </div>
</template>

<script lang="ts" setup>
import { ref, provide } from 'vue'
import Main from "../../components/Main.vue";
import Footer from "../../components/Footer.vue";
import '../../styles/theme.css';
// Element Plus 基础与暗色变量
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

const showAdvanced = ref(window.location.hash.startsWith('#settings-'));
provide('showAdvanced', showAdvanced);

</script>

<style scoped>
.popup-shell { display: flex; flex-direction: column; max-height: 600px; }
.popup-content { padding: 12px; min-height: 0; overflow-y: auto; }
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.footer-bar {
  flex-shrink: 0;
  min-height: 0;
}
</style>
