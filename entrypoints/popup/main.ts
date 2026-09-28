import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import 'element-plus/dist/index.css';
import { ElContainer, ElHeader, ElMain, ElSelect, ElOption, ElInput, ElSwitch, ElButton } from 'element-plus';

const app = createApp(App);
for (const component of [ElContainer, ElHeader, ElMain, ElSelect, ElOption, ElInput, ElSwitch, ElButton]) {
  if (component.name) app.component(component.name, component);
}
app.mount('#app');
