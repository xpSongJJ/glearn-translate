<template>
  <div style="height: 100%; display: flex; flex-direction: column;">
    <el-container>
      <el-header class="custom-padding">
        <Header/>
      </el-header>
      <el-main class="custom-padding" style="min-height: 320px">
        <Main/>
      </el-main>
      <footer class="footer-bar">
        <Footer/>
      </footer>
    </el-container>
  </div>
</template>

<script lang="ts" setup>
import { ref, provide } from 'vue'
import Header from '../../components/Header.vue';
import Main from "../../components/Main.vue";
import Footer from "../../components/Footer.vue";
import '../../styles/theme.css';
// Element Plus 基础与暗色变量
import 'element-plus/theme-chalk/base.css';
import 'element-plus/theme-chalk/dark/css-vars.css';

const showAdvanced = ref(false);
provide('showAdvanced', showAdvanced);

</script>

<style scoped>
@media screen and (max-height: 800px) {
  .popup-container {
    max-height: 90vh;
  }
}

@media screen and (max-width: 480px) {
  .popup-container {
    width: 95vw;
  }
}

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

.el-main {
  flex: 1;
  min-height: 320px;
}

.el-container {
  flex-direction: column !important;
}

.custom-padding {
  padding: 12px 16px;
}

.footer-bar {
  flex-shrink: 0;
  min-height: 0;
}
</style>
