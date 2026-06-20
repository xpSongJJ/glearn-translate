<template>
  <!-- 搜索翻译（始终置顶） -->
  <el-row class="margin-bottom margin-left-2em">
    <el-col :span="24">
      <el-input
        ref="searchInputRef"
        v-model="searchText"
        placeholder="输入文本，回车翻译"
        @keyup.enter="handleSearch"
        clearable
      />
    </el-col>
  </el-row>

  <!-- 开关 -->
  <el-row class="margin-bottom margin-left-2em">
    <el-col :span="20" class="lightblue rounded-corner">
      <span class="popup-text popup-vertical-left">插件状态</span>
    </el-col>

    <el-col :span="4" class="flex-end">
      <el-switch v-model="config.on" inline-prompt active-text="开" inactive-text="关" @change="handlePluginStateChange" />
    </el-col>
  </el-row>

  <!-- 占位符 -->
  <div v-if="!config.on">
    <el-empty description="插件处于禁用状态" />
  </div>

  <div v-show="config.on">
    <!--    翻译模式-->
    <el-row class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">翻译模式</span>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.display" placeholder="请选择翻译模式">
          <el-option class="select-left" v-for="item in options.display" :key="item.value" :label="item.label"
            :value="item.value" />
        </el-select>
      </el-col>
    </el-row>

    <!--    译文样式选择器-->
    <el-row v-show="config.display === 1" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="选择双语模式下译文的显示样式，提供多种美观的效果" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">译文样式<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.style" placeholder="请选择译文显示样式">
          <el-option-group v-for="group in styleGroups" :key="group.value" :label="group.label">
            <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value"
              :class="item.class" />
          </el-option-group>
        </el-select>
      </el-col>
    </el-row>

    <!-- 翻译服务 -->
    <el-row class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="机器翻译：快速稳定，适合日常使用；AI翻译：更自然流畅，需要配置令牌" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">翻译服务<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <b>
          <el-select v-model="config.service" placeholder="请选择翻译服务">
            <el-option class="select-left" v-for="item in compute.filteredServices" :key="item.value"
              :label="item.label" :value="item.value" :disabled="item.disabled"
              :class="{ 'select-divider': item.disabled }" />
          </el-select>
        </b>
      </el-col>
    </el-row>

    <!-- 目标语言 -->
    <el-row class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">目标语言</span>
      </el-col>
      <el-col :span="12">
        <el-select v-model="config.to" placeholder="请选择目标语言">
          <el-option class="select-left" v-for="item in options.to" :key="item.value" :label="item.label"
            :value="item.value" />
        </el-select>
      </el-col>
    </el-row>



    <!-- 鼠标悬浮快捷键 -->
    <el-row class="margin-bottom margin-left-2em" :class="{ 'custom-hotkey-row': config.hotkey === 'custom' }">
      <el-col :span="14" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="按住指定快捷键并悬停在文本上进行翻译" placement="top-start" :show-after="500">
        <span class="popup-text popup-vertical-left">
          鼠标悬浮快捷键
          <el-icon class="icon-margin">
            <ChatDotRound />
          </el-icon>
        </span>
        </el-tooltip>
      </el-col>
      <el-col :span="10" class="flex-end">
        <div class="hotkey-config">
          <el-select 
            v-model="config.hotkey" 
            placeholder="请选择快捷键" 
            size="small" 
            style="width: 100%"
            @change="handleMouseHotkeyChange"
          >
            <el-option v-for="item in options.keys" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" :class="{ 'select-divider': item.disabled }" />
          </el-select>
          
          <!-- 自定义快捷键显示（选择自定义时总是显示） -->
          <div v-if="config.hotkey === 'custom'" class="custom-hotkey-display">
            <span class="hotkey-text" v-if="config.customHotkey">
              {{ getCustomMouseHotkeyDisplayName() }}
            </span>
            <span class="hotkey-text placeholder-text" v-else>
              点击设置自定义快捷键
            </span>
            <el-button size="small" type="text" @click="openCustomMouseHotkeyDialog" class="edit-button">
              <el-icon><Edit /></el-icon>
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 全文翻译快捷键选择 -->
    <el-row v-if="config.on" class="margin-bottom margin-left-2em margin-top-1em" :class="{ 'custom-hotkey-row': config.floatingBallHotkey === 'custom' }">
      <el-col :span="14" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="（测试版）设置快捷键以便快速切换全文翻译状态，无需鼠标点击悬浮球" placement="top-start" :show-after="500">
        <span class="popup-text popup-vertical-left">
          <!-- <span class="new-feature-badge">新</span> -->
          全文翻译快捷键
          <el-icon class="icon-margin">
            <ChatDotRound />
          </el-icon>
        </span>
        </el-tooltip>
      </el-col>
      <el-col :span="10" class="flex-end">
        <div class="hotkey-config">
          <el-select 
            v-model="config.floatingBallHotkey" 
            placeholder="选择快捷键" 
            size="small" 
            style="width: 100%"
            @change="handleHotkeyChange"
          >
            <el-option v-for="item in options.floatingBallHotkeys" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          
          <!-- 自定义快捷键显示（选择自定义时总是显示） -->
          <div v-if="config.floatingBallHotkey === 'custom'" class="custom-hotkey-display">
            <span class="hotkey-text" v-if="config.customFloatingBallHotkey">
              {{ getCustomHotkeyDisplayName() }}
            </span>
            <span class="hotkey-text placeholder-text" v-else>
              点击设置自定义快捷键
            </span>
            <el-button size="small" type="text" @click="openCustomHotkeyDialog" class="edit-button">
              <el-icon><Edit /></el-icon>
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>


    <!-- 划词翻译模式选择 -->
    <el-row v-if="config.on" class="margin-bottom margin-left-2em margin-top-1em">
      <el-col :span="14" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="选中文本后显示红点，鼠标移到红点上查看翻译结果。可选择关闭、双语显示或只显示译文" placement="top-start" :show-after="500">
      <span class="popup-text popup-vertical-left">
        <!-- <span class="new-feature-badge">新</span> -->
        划词翻译
        <el-icon class="icon-margin">
          <ChatDotRound />
        </el-icon>
      </span>
        </el-tooltip>
      </el-col>
      <el-col :span="10" class="flex-end">
        <el-select v-model="config.selectionTranslatorMode" placeholder="选择模式" size="small" style="width: 100%">
          <el-option label="关闭" value="disabled" />
          <el-option label="双语显示" value="bilingual" />
          <el-option label="只显示译文" value="translation-only" />
        </el-select>
      </el-col>
    </el-row>

    <!-- token -->
    <el-row v-show="compute.showToken" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="API访问令牌仅保存在本地，用于访问翻译服务。获取方式请参考对应服务的官方文档；翻译服务为 ollama 时，token 可为任意值" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">访问令牌<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.token[config.service]" type="password" show-password placeholder="请输入API访问令牌" />
      </el-col>
    </el-row>

    <!-- Azure OpenAI 端点配置 -->
    <el-row v-show="compute.showAzureOpenaiEndpoint" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="Azure OpenAI 服务端点地址，必须包含完整的部署信息。格式：https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name/chat/completions?api-version=2024-02-15-preview" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Azure 端点<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input
          v-model="config.azureOpenaiEndpoint"
          placeholder="https://your-resource.openai.azure.com/openai/deployments/your-model/chat/completions?api-version=2024-02-15-preview"
          :class="{ 'input-error': config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint) }"
        />
        <div v-if="config.azureOpenaiEndpoint && !isValidAzureEndpoint(config.azureOpenaiEndpoint)" class="error-text">
          端点地址格式不正确，请确保包含 openai.azure.com 域名和 /chat/completions 路径
        </div>
      </el-col>
    </el-row>

    <!-- DeepLX URL 配置-->
    <el-row v-show="compute.showDeepLX" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          content="DeepLX API 服务地址，默认为本地地址。如果使用远程 DeepLX 服务，请修改为对应的服务地址" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">服务地址</span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.deeplx" placeholder="http://localhost:1188/translate" />
      </el-col>
    </el-row>

    <!-- 使用AkSk -->
    <el-row v-show="compute.showAkSk" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">API Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.ak" placeholder="请输入Access Key" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showAkSk" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="百度文心一言API密钥对，用于访问翻译服务" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.sk" type="password" placeholder="请输入Secret Key" />
      </el-col>
    </el-row>

    <!-- 有道翻译配置 -->
    <el-row v-show="compute.showYoudao" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="有道智云翻译API应用ID，用于访问有道翻译服务。可在有道智云控制台获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">App Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.youdaoAppKey" placeholder="有道 AppKey" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showYoudao" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="有道智云翻译API应用密钥，用于访问有道翻译服务。可在有道智云控制台获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">App Secret<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.youdaoAppSecret" type="password" show-password placeholder="有道 AppSecret" />
      </el-col>
    </el-row>

    <!-- 腾讯云机器翻译配置 -->
    <el-row v-show="compute.showTencent" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="腾讯云API访问密钥ID，用于访问腾讯云机器翻译服务。可在腾讯云控制台的访问管理中获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret ID<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.tencentSecretId" placeholder="腾讯云 SecretId" />
      </el-col>
    </el-row>
    <el-row v-show="compute.showTencent" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="腾讯云API访问密钥，用于访问腾讯云机器翻译服务。可在腾讯云控制台的访问管理中获取" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">Secret Key<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.tencentSecretKey" type="password" show-password placeholder="腾讯云 SecretKey" />
      </el-col>
    </el-row>

    <!--  Coze需显示 robot_id -->
    <el-row v-show="compute.showRobotId" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="Coze机器人ID，可在Coze开发者文档中查看获取方式" placement="top-start"
          :show-after="500">
          <span class="popup-text popup-vertical-left">机器人ID<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.robot_id[config.service]" placeholder="请输入Coze机器人ID" />
      </el-col>
    </el-row>

    <!-- 本地大模型配置 -->
    <el-row v-show="compute.showCustom" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="目前仅支持OpenAI格式的请求接口，如http://localhost:3000/v1/chat/completions，其中 localhost:11434 可更换为任意值。
                     ollama 配置请参考：https://fluent.thinkstu.com/guide/faq.html" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">自定义接口<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.custom" placeholder="请输入自定义接口地址" />
      </el-col>
    </el-row>

    <!-- NewAPI 配置 -->
    <el-row v-show="compute.showNewAPI" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark" content="填写 New API 的访问地址，如：http://localhost:3000" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">NewAPI接口<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.newApiUrl" placeholder="请输入您的New API接口地址" />
      </el-col>
    </el-row>

    <!--  模型 -->
    <el-row v-show="compute.showModel" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <span class="popup-text popup-vertical-left">模型</span>
      </el-col>
      <el-col :span="12">
        <div style="display: flex; align-items: center; gap: 4px;">
          <el-select v-model="config.model[config.service]" placeholder="请选择模型" :loading="loadingModels" style="flex: 1;">
            <el-option class="select-left" v-for="item in compute.model" :key="item" :label="item" :value="item" />
          </el-select>
          <el-button v-show="compute.showModel" :icon="Refresh" circle size="small" @click="refreshModelList" :loading="loadingModels" title="拉取最新模型列表" />
        </div>
        <div v-if="modelFetchError" style="font-size: 11px; color: #E6A23C; margin-top: 2px;">{{ modelFetchError }}</div>
      </el-col>
    </el-row>

    <el-row v-show="compute.showCustomModel" class="margin-bottom margin-left-2em">
      <el-col :span="12" class="lightblue rounded-corner">
        <el-tooltip class="box-item" effect="dark"
          :content="config.service === 'doubao' ? '豆包的model为接入点，获取方式见官方文档：https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint' : '注意：自定义模型名称需要与服务商提供的模型名称一致，否则无法使用！'"
          placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">{{ config.service === 'doubao' ? '接入点' : '自定义模型' }}<el-icon
              class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
        </el-tooltip>
      </el-col>
      <el-col :span="12">
        <el-input v-model="config.customModel[config.service]" placeholder="例如：gemma:7b" />
      </el-col>
    </el-row>

  </div>

  <!-- 高级选项弹窗 -->
  <teleport to="body">
    <div v-if="showAdvanced" class="advanced-overlay" @click.self="showAdvanced = false">
      <div class="advanced-panel">
        <!-- 主题设置 -->
        <el-row class="margin-bottom">
          <el-col :span="12" class="lightblue rounded-corner">
            <span class="popup-text popup-vertical-left">主题设置</span>
          </el-col>
          <el-col :span="12">
            <el-select v-model="config.theme" placeholder="请选择主题模式" size="small">
              <el-option class="select-left" v-for="item in options.theme" :key="item.value" :label="item.label"
                         :value="item.value" />
            </el-select>
          </el-col>
        </el-row>

        <!-- 缓存开关 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="18" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark" content="开启缓存可以提高翻译速度，减少重复请求，但可能导致翻译结果不是最新的" placement="top-start" :show-after="500">
        <span class="popup-text popup-vertical-left">缓存翻译结果<el-icon class="icon-margin">
            <ChatDotRound />
          </el-icon></span>
            </el-tooltip>
          </el-col>

          <el-col :span="6" class="flex-end">
            <el-switch v-model="config.useCache" />
          </el-col>
        </el-row>

        <!-- 悬浮球开关 -->
      <el-row v-if="config.on" class="margin-bottom margin-left-2em">
        <el-col :span="18" class="lightblue rounded-corner">
          <el-tooltip class="box-item" effect="dark" content="（测试版）控制是否显示屏幕边缘的即时翻译悬浮球，用于对整个网页进行翻译" placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">
            <!-- <span class="new-feature-badge">新</span> -->
            全文翻译悬浮球
            <el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon>
          </span>
          </el-tooltip>
        </el-col>

        <el-col :span="6" class="flex-end">
          <el-switch v-model="floatingBallEnabled" />
        </el-col>
      </el-row>


        <!-- 翻译进度面板 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="18" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark"
                        content="翻译进度面板（默认关）：关闭后将不再显示右下角的全文翻译进度面板，适合移动端或希望更少打扰的用户。"
                        placement="top-start" :show-after="500">
          <span class="popup-text popup-vertical-left">翻译进度面板<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
            </el-tooltip>
          </el-col>
          <el-col :span="6" class="flex-end">
          <el-switch v-model="config.translationStatus" />
          </el-col>
        </el-row>

        <!-- 禁用动画设置 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="18" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark"
                        content="动画效果（默认开）：禁用后将关闭加载/悬浮等动画，以节省GPU资源和电量。适合低配置设备或希望节省资源的用户。"
                        placement="top-start" :show-after="500">
              <span class="popup-text popup-vertical-left">动画效果<el-icon class="icon-margin">
                  <ChatDotRound />
                </el-icon></span>
            </el-tooltip>
          </el-col>
          <el-col :span="6" class="flex-end">
            <el-switch v-model="config.animations" />
          </el-col>
        </el-row>

        <!-- 输入框翻译功能 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="12" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark"
                        content="输入框翻译：在任何文本输入框中使用指定方式触发翻译当前输入的内容。"
                        placement="top-start" :show-after="500">
              <span class="popup-text popup-vertical-left">输入框翻译<el-icon class="icon-margin">
                  <ChatDotRound />
                </el-icon></span>
            </el-tooltip>
          </el-col>
          <el-col :span="12">
            <el-select v-model="config.inputBoxTranslationTrigger" placeholder="请选择触发方式" size="small">
              <el-option class="select-left" v-for="item in options.inputBoxTranslationTrigger" :key="item.value" 
                         :label="item.label" :value="item.value" />
            </el-select>
          </el-col>
        </el-row>

        <!-- 输入框翻译目标语言 -->
        <el-row v-if="config.inputBoxTranslationTrigger !== 'disabled'" class="margin-bottom margin-left-2em">
          <el-col :span="12" class="lightblue rounded-corner">
            <span class="popup-text popup-vertical-left">翻译目标语言</span>
          </el-col>
          <el-col :span="12">
            <el-select v-model="config.inputBoxTranslationTarget" placeholder="请选择目标语言" size="small">
              <el-option class="select-left" v-for="item in options.inputBoxTranslationTarget" :key="item.value" 
                         :label="item.label" :value="item.value" />
            </el-select>
          </el-col>
        </el-row>

        <!-- 翻译并发数 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="12" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark" content="控制同时进行的最大翻译任务数，数值越高翻译速度越快，但可能占用更多系统资源" placement="top-start"
                        :show-after="500">
          <span class="popup-text popup-vertical-left">翻译并发数<el-icon class="icon-margin">
              <ChatDotRound />
            </el-icon></span>
            </el-tooltip>
          </el-col>
          <el-col :span="12">
            <el-input-number
                v-model="config.maxConcurrentTranslations" size="small"
                :min="1"
                :max="100"
                :step="1"
                style="width: 100%"
                @change="handleConcurrentChange"
                controls-position="right"
            />
          </el-col>
        </el-row>

        <!-- 使用代理转发 -->
        <el-row v-show="compute.showProxy" class="margin-bottom margin-left-2em">
          <el-col :span="12" class="lightblue rounded-corner">
            <el-tooltip class="box-item" effect="dark" content="使用代理可以解决网络无法访问的问题，如不熟悉代理设置请留空！" placement="top-start"
                        :show-after="500">
              <span class="popup-text popup-vertical-left">代理地址<el-icon class="icon-margin">
                  <ChatDotRound />
                </el-icon></span>
            </el-tooltip>
          </el-col>
          <el-col :span="12">
            <el-input v-model="config.proxy[config.service]" placeholder="默认不使用代理" size="small" />
          </el-col>
        </el-row>

        <!-- 角色和模板 -->
        <el-row v-show="compute.showAI" class="margin-bottom margin-left-2em">
          <el-col :span="24">
            <el-tooltip class="box-item" effect="dark" content="以系统身份 system 发送的对话，常用于指定 AI 要扮演的角色"
              placement="top-start" :show-after="500">
              <span class="popup-text" style="display: block; text-align: left;">system<el-icon class="icon-margin">
                  <ChatDotRound />
                </el-icon></span>
            </el-tooltip>
            <el-input type="textarea" v-model="config.system_role[config.service]" maxlength="8192" size="small"
              :autosize="{ minRows: 4, maxRows: 12 }" placeholder="system message" />
          </el-col>
        </el-row>
        <el-row v-show="compute.showAI" class="margin-bottom margin-left-2em">
          <el-col :span="24">
            <el-tooltip class="box-item" effect="dark"
              content="以用户身份 user 发送的对话，其中{{to}}表示目标语言，{{origin}}表示待翻译的文本内容，两者不可缺少。"
              placement="top-start" :show-after="500">
              <span class="popup-text" style="display: block; text-align: left;">user<el-icon class="icon-margin">
                  <ChatDotRound />
                </el-icon></span>
            </el-tooltip>
            <el-input type="textarea" v-model="config.user_role[config.service]" maxlength="8192" size="small"
              :autosize="{ minRows: 4, maxRows: 12 }" placeholder="user message template" />
          </el-col>
        </el-row>
        <!-- 恢夏默认模板按钮 -->
        <el-row v-show="compute.showAI" class="margin-bottom margin-left-2em">
          <el-col :span="24" style="text-align: right;">
            <el-button type="primary" link @click="resetTemplate" size="small">
              <el-icon>
                <Refresh />
              </el-icon>
              恢复默认模板
            </el-button>
          </el-col>
        </el-row>

        <!-- 配置导入导出 -->
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="24">
            <el-divider content-position="center">配置管理</el-divider>
          </el-col>
        </el-row>
        <el-row class="margin-bottom margin-left-2em">
          <el-col :span="12">
            <el-button type="primary" @click="handleExport" size="small">
              <el-icon>
                <Download />
              </el-icon>
              导出配置
            </el-button>
          </el-col>
          <el-col :span="12">
            <el-button type="success" @click="handleImport" size="small">
              <el-icon>
                <Upload />
              </el-icon>
              导入配置
            </el-button>
          </el-col>
        </el-row>

        <!-- 导出配置 -->
        <el-row v-if="showExportBox" class="margin-bottom margin-left-2em">
          <el-col :span="24">
            <el-input v-model="exportData" type="textarea" :rows="8" readonly />
          </el-col>
        </el-row>

        <!-- 导入配置 -->
        <el-row v-if="showImportBox" class="margin-bottom margin-left-2em">
          <el-col :span="24">
            <el-input v-model="importData" type="textarea" :rows="8" placeholder="请在此处粘贴您的JSON配置" />
            <div style="margin-top: 10px; text-align: right;">
              <el-button @click="saveImport" size="small">保存</el-button>
            </div>
          </el-col>
        </el-row>
      </div>
    </div>
  </teleport>
  <!--    -->

  <!-- 自定义快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomHotkeyDialog"
    :current-value="config.customFloatingBallHotkey"
    @confirm="handleCustomHotkeyConfirm"
    @cancel="handleCustomHotkeyCancel"
  />

  <!-- 自定义鼠标悬浮快捷键对话框 -->
  <CustomHotkeyInput
    v-model="showCustomMouseHotkeyDialog"
    :current-value="config.customHotkey"
    @confirm="handleCustomMouseHotkeyConfirm"
    @cancel="handleCustomMouseHotkeyCancel"
  />

  <!-- 搜索翻译结果悬浮框 -->
  <teleport to="body">
    <div v-if="showSearchResult" class="search-translation-overlay" @click.self="closeSearchResult">
      <div class="search-translation-popup" :class="{ 'fr-dark-theme': isDarkTheme }">
        <div class="fr-tooltip-header">
          <span>翻译结果<small>（{{ currentServiceLabel }}）</small></span>
          <div class="fr-tooltip-actions">
            <button class="fr-action-btn" @click="copySearchResult" title="复制译文">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="fr-close-btn" @click="closeSearchResult">×</button>
          </div>
        </div>
        <div class="fr-tooltip-content">
          <div class="fr-original-text fr-no-select">
            <pre>{{ searchText }}</pre>
          </div>
          <div v-if="searchLoading && !searchResult" :class="['fr-loading-spinner', { 'fr-static': !config.animations }]"></div>
          <div v-else-if="searchError" class="fr-error-message">{{ searchError }}</div>
          <div v-else class="fr-translation-result fr-no-select">
            <pre>{{ searchResult }}</pre>
          </div>
        </div>
      </div>
    </div>
  </teleport>

  <!-- 底部操作栏 -->
  <el-row class="action-bar-row">
    <el-col :span="12" style="text-align:left">
      <el-link
        class="action-link"
        :class="{ 'failed': actionText === '清除失败', 'success': actionText === '清除成功' }"
        @click="clearCache"
        :disabled="actionDisabled"
      >
        <el-icon v-if="actionLoading">
          <Loading class="el-icon-loading" />
        </el-icon>
        {{ actionText }}
      </el-link>
    </el-col>
    <el-col :span="12" style="text-align:right">
      <el-link class="action-link" href="https://github.com/xpSongJJ/glearn-translate" target="_blank">
        <el-icon>
          <Star />
        </el-icon>
        GitHub开源
      </el-link>
    </el-col>
  </el-row>

</template>

<script lang="ts" setup>

// Main 处理配置信息
import { computed, ref, watch, onMounted, onUnmounted, useTemplateRef, inject } from 'vue'
import { options, servicesType, defaultOption, customModelString } from "../entrypoints/utils/option";
import { Config } from "@/entrypoints/utils/model";
import { fetchModels } from "@/entrypoints/utils/modelFetcher";
import { storage } from '@wxt-dev/storage';
import { ChatDotRound, Refresh, Edit, Upload, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElInputNumber } from 'element-plus'
import browser from 'webextension-polyfill';
import { defineAsyncComponent } from 'vue';
const CustomHotkeyInput = defineAsyncComponent(() => import('@/components/CustomHotkeyInput.vue'));
import { parseHotkey } from '@/entrypoints/utils/hotkey';
import { translateTextStream } from '@/entrypoints/utils/translateApi';
import type { Ref } from 'vue';

// 初始化深色模式媒体查询
const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 更新主题函数
function updateTheme(theme: string) {
  if (theme === 'auto') {
    // 自动模式下，直接使用系统主题
    const isDark = darkModeMediaQuery.matches;
    console.log('isDark', isDark);

    document.documentElement.classList.toggle('dark', isDark);
  } else {
    // 手动模式下，使用选择的主题
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// 配置信息
let config = ref(new Config());

// 远程模型列表（按服务缓存）
const remoteModels = ref<Record<string, string[]>>({});
// 是否正在拉取模型列表
const loadingModels = ref(false);
// 模型拉取错误信息
const modelFetchError = ref('');

// 拉取模型列表
async function refreshModelList() {
    const service = config.value.service;
    // 机器翻译或 Coze 无需拉取
    if (servicesType.isMachine(service) || servicesType.isCoze(service) || servicesType.isTencent(service)) {
        return;
    }

    loadingModels.value = true;
    modelFetchError.value = '';

    const result = await fetchModels(service, {
        token: config.value.token[service] || '',
        proxy: config.value.proxy[service] || '',
        ak: config.value.ak || '',
        sk: config.value.sk || '',
    });

    if (result && result.length > 0) {
        remoteModels.value[service] = result;
        // 持久化到 storage
        config.value.cachedModels[service] = JSON.stringify(result);
        storage.setItem('local:config', JSON.stringify(config.value));
    } else {
        modelFetchError.value = '拉取失败，请检查网络或Token后重试';
        // 如有缓存用缓存
        if (config.value.cachedModels[service]) {
            try {
                const cached = JSON.parse(config.value.cachedModels[service]);
                if (Array.isArray(cached) && cached.length > 0) {
                    remoteModels.value[service] = cached;
                }
            } catch { /* ignore parse error */ }
        }
    }
    loadingModels.value = false;
}

// 初始化时恢复已缓存的模型列表
function restoreCachedModels() {
    const cached = config.value.cachedModels;
    if (cached && typeof cached === 'object') {
        for (const [service, json] of Object.entries(cached)) {
            try {
                const list = JSON.parse(json as string);
                if (Array.isArray(list) && list.length > 0) {
                    remoteModels.value[service] = list;
                }
            } catch { /* ignore */ }
        }
    }
}

// 从 storage 中获取本地配置
storage.getItem('local:config').then((value: any) => {
  if (typeof value === 'string' && value) {
    const parsedConfig = JSON.parse(value);
    Object.assign(config.value, parsedConfig);
  }
  restoreCachedModels();
  // 初始应用主题
  updateTheme(config.value.theme || 'auto');
  // 如果当前服务有 token 但无缓存模型，自动拉取
  const service = config.value.service;
  if (config.value.token?.[service] && !remoteModels.value[service]) {
    refreshModelList();
  }
});

// 监听 storage 中 'local:config' 的变化
// 当其他页面修改了配置时,会触发这个监听器
// newValue 是新的配置值,oldValue 是旧的配置值
storage.watch('local:config', (newValue: any, oldValue: any) => {
  // 检查 newValue 是否为非空字符串
  if (typeof newValue === 'string' && newValue) {
    // 将新的配置值解析为对象,并合并到当前的 config.value 中
    // 这样可以保持所有页面的配置同步
    Object.assign(config.value, JSON.parse(newValue));
  }
});

// 监听菜单栏配置变化
// 当配置发生改变时,将新的配置序列化为 JSON 字符串并保存到 storage 中
// deep: true 表示深度监听对象内部属性的变化
watch(config, (newValue: any, oldValue: any) => {
  // TODO 监听配置变化，显示刷新提示
  storage.setItem('local:config', JSON.stringify(newValue));
}, { deep: true });

// 服务/token 变化不再自动拉取模型列表，由用户点击刷新按钮手动触发

// 计算属性
let compute = ref({
  // 1、是否是AI服务
  showAI: computed(() => servicesType.isAI(config.value.service)),
  // 2、是否是机器翻译
  showMachine: computed(() => servicesType.isMachine(config.value.service)),
  // 3、是否显示代理
  showProxy: computed(() => servicesType.isUseProxy(config.value.service)),
  // 4、是否显示模型
  showModel: computed(() => servicesType.isUseModel(config.value.service)),
  // 5、是否显示token
  showToken: computed(() => servicesType.isUseToken(config.value.service)),
  // 6、是否显示 AkSk
  showAkSk: computed(() => servicesType.isUseAkSk(config.value.service)),
  // 6.5、是否显示有道翻译配置
  showYoudao: computed(() => servicesType.isYoudao(config.value.service)),
  // 6.6、是否显示腾讯云机器翻译配置
  showTencent: computed(() => servicesType.isTencent(config.value.service)),
  // 7、获取模型列表（远程拉取优先 → 缓存 → 自定义入口）
  model: computed(() => {
    const service = config.value.service;
    const remote = remoteModels.value[service];
    if (remote && remote.length > 0) return remote;
    // 尝试从缓存解析
    const cached = config.value.cachedModels?.[service];
    if (cached) {
      try {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) return list;
      } catch { /* ignore */ }
    }
    // 无远程也无缓存时，提供自定义模型入口
    return [customModelString];
  }),
  // 8、是否需要自定义接口
  showCustom: computed(() => servicesType.isCustom(config.value.service)),
  // 9、是否显示 DeepLX URL 配置
  showDeepLX: computed(() => config.value.service === 'deeplx'),
  // 10、是否自定义模型
  showCustomModel: computed(() => servicesType.isAI(config.value.service) && config.value.model[config.value.service] === customModelString),
  // 11、判断是否为"双语模式"，控制一些翻译服务的显示
  filteredServices: computed(() => options.services.filter((service: any) =>
    !([service.google].includes(service.value) && config.value.display !== 1))
  ),
  // 12、判断是否为 coze
  showRobotId: computed(() => servicesType.isCoze(config.value.service)),
  // 13、是否显示New API配置
  showNewAPI: computed(() => servicesType.isNewApi(config.value.service)),
  // 14、是否显示Azure OpenAI端点配置
  showAzureOpenaiEndpoint: computed(() => servicesType.isAzureOpenai(config.value.service)),
})

// 监听主题变化
watch(() => config.value.theme, (newTheme) => {
  updateTheme(newTheme || 'auto');
});

// 使用 onchange 监听系统主题变化
darkModeMediaQuery.onchange = (e) => {
  if (config.value.theme === 'auto') {
    updateTheme('auto');
  }
};

// 组件卸载时清理
onUnmounted(() => {
  darkModeMediaQuery.onchange = null;
});

// 计算样式分组
const styleGroups = computed(() => {
  const groups = options.styles.filter(item => item.disabled);
  return groups.map(group => ({
    ...group,
    options: options.styles.filter(item => !item.disabled && item.group === group.value)
  }));
});

// 恢复默认模板
const resetTemplate = () => {
  ElMessageBox.confirm(
    '确定要恢复默认的 system 和 user 模板吗？此操作将覆盖当前的自定义模板。',
    '恢复默认模板',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(() => {
    config.value.system_role[config.value.service] = defaultOption.system_role;
    config.value.user_role[config.value.service] = defaultOption.user_role;
    ElMessage({
      message: '已成功恢复默认翻译模板',
      type: 'success',
      duration: 2000
    });
  }).catch(() => {
    // 用户取消操作，不做任何处理
  });
};

// 悬浮球开关的计算属性
const floatingBallEnabled = computed({
  get: () => !config.value.disableFloatingBall && config.value.on,
  set: (value) => {
    config.value.disableFloatingBall = !value;
    // 向所有激活的标签页发送消息
    browser.tabs.query({}).then(tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          browser.tabs.sendMessage(tab.id, { 
            type: 'toggleFloatingBall',
            isEnabled: value 
          }).catch(() => {
            // 忽略发送失败的错误（可能是页面未加载内容脚本）
          });
        }
      });
    });
  }
});

// 监听划词翻译模式变化
watch(() => config.value.selectionTranslatorMode, (newMode) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'updateSelectionTranslatorMode',
          mode: newMode 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
});

// 监听开关变化
const handleSwitchChange = () => {
  showRefreshTip.value = true;
};

// 处理插件状态变化
const handlePluginStateChange = (val: boolean) => {
  // 如果插件被关闭，确保悬浮球和划词翻译也被关闭
  if (!val) {
    // 处理悬浮球
    if (!config.value.disableFloatingBall) {
      config.value.disableFloatingBall = true;
      // 向所有激活的标签页发送消息，关闭悬浮球
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'toggleFloatingBall',
              isEnabled: false
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
    
    // 处理划词翻译
    if (config.value.selectionTranslatorMode !== 'disabled') {
      config.value.selectionTranslatorMode = 'disabled';
      // 向所有激活的标签页发送消息，关闭划词翻译
      browser.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { 
              type: 'updateSelectionTranslatorMode',
              mode: 'disabled'
            }).catch(() => {
              // 忽略发送失败的错误（可能是页面未加载内容脚本）
            });
          }
        });
      });
    }
  }
};

// 处理悬浮球开关变化
const toggleFloatingBall = (val: boolean) => {
  // 向所有激活的标签页发送消息
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id) {
        browser.tabs.sendMessage(tab.id, { 
          type: 'toggleFloatingBall',
          isEnabled: val 
        }).catch(() => {
          // 忽略发送失败的错误（可能是页面未加载内容脚本）
        });
      }
    });
  });
};

// 自定义快捷键相关
const showCustomHotkeyDialog = ref(false);
const showCustomMouseHotkeyDialog = ref(false);

// 配置导入导出相关
const showExportConfig = ref(false);
const showImportConfig = ref(false);
const exportedConfig = ref('');
const importConfigText = ref('');
const importLoading = ref(false);

// 处理快捷键选择变化
const handleHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customFloatingBallHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义快捷键对话框
const openCustomHotkeyDialog = () => {
  showCustomHotkeyDialog.value = true;
};

// 确认自定义快捷键
const handleCustomHotkeyConfirm = (hotkey: string) => {
  config.value.customFloatingBallHotkey = hotkey;
  config.value.floatingBallHotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义快捷键
const handleCustomHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customFloatingBallHotkey) {
    config.value.floatingBallHotkey = 'Alt+T';
  }
};

// 获取自定义快捷键显示名称
const getCustomHotkeyDisplayName = () => {
  if (!config.value.customFloatingBallHotkey) return '';
  
  if (config.value.customFloatingBallHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customFloatingBallHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customFloatingBallHotkey;
};

// 处理鼠标悬浮快捷键选择变化
const handleMouseHotkeyChange = (value: string) => {
  if (value === 'custom') {
    // 选择自定义后，如果没有设置过自定义快捷键，自动打开设置对话框
    if (!config.value.customHotkey) {
      // 延迟一下，让选择框先完成状态更新
      setTimeout(() => {
        openCustomMouseHotkeyDialog();
      }, 100);
    }
  }
};

// 打开自定义鼠标悬浮快捷键对话框
const openCustomMouseHotkeyDialog = () => {
  showCustomMouseHotkeyDialog.value = true;
};

// 确认自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyConfirm = (hotkey: string) => {
  config.value.customHotkey = hotkey;
  config.value.hotkey = 'custom';
  
  ElMessage({
    message: hotkey === 'none' ? '已禁用快捷键' : `快捷键已设置为: ${getCustomMouseHotkeyDisplayName()}`,
    type: 'success',
    duration: 2000
  });
};

// 取消自定义鼠标悬浮快捷键
const handleCustomMouseHotkeyCancel = () => {
  // 如果没有自定义快捷键，回退到默认选项
  if (!config.value.customHotkey) {
    config.value.hotkey = 'Control';
  }
};

// 获取自定义鼠标悬浮快捷键显示名称
const getCustomMouseHotkeyDisplayName = () => {
  if (!config.value.customHotkey) return '';
  
  if (config.value.customHotkey === 'none') {
    return '已禁用';
  }
  
  const parsed = parseHotkey(config.value.customHotkey);
  return parsed.isValid ? parsed.displayName : config.value.customHotkey;
};

// 处理并发数量变化
const handleConcurrentChange = (currentValue: number | undefined, oldValue: number | undefined) => {
  // 验证并发数量的有效性
  if (currentValue === undefined || currentValue < 1 || currentValue > 100) {
    ElMessage({
      message: '并发数量必须在 1-100 之间',
      type: 'warning',
      duration: 2000
    });
    // 恢复默认值
    config.value.maxConcurrentTranslations = 6;
    return;
  }
  
  // 显示设置已更新的提示
  showRefreshTip.value = true;
  
  ElMessage({
    message: `并发数量已更新为 ${currentValue}`,
    type: 'success',
    duration: 2000
  });
};

// 显示刷新提示
const showRefreshTip = ref(false);

// 刷新页面
const refreshPage = async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    browser.tabs.reload(tabs[0].id);
    showRefreshTip.value = false; // 刷新后隐藏提示
  }
};

const showExportBox = ref(false);
const exportData = ref('');
const showImportBox = ref(false);
const importData = ref('');

// 搜索翻译相关状态
const searchText = ref('');
const searchResult = ref('');
const searchLoading = ref(false);
const searchError = ref('');
const showSearchResult = ref(false);
const searchInputRef = useTemplateRef('searchInputRef');
const showAdvanced = inject<Ref<boolean>>('showAdvanced')!;

// 清除缓存操作
const actionDisabled = ref(false);
const actionText = ref('清除翻译缓存');
const actionLoading = ref(false);

async function clearCache() {
  try {
    actionDisabled.value = true;
    actionText.value = "正在清除...";
    actionLoading.value = true;

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      throw new Error('No active tab found');
    }

    await browser.tabs.sendMessage(tabs[0].id, { message: 'clearCache' });

    actionText.value = "清除成功";

    setTimeout(() => {
      actionDisabled.value = false;
      actionText.value = '清除翻译缓存';
      actionLoading.value = false;
    }, 1500);

  } catch (error) {
    console.error('清除缓存失败:', error);
    actionText.value = "清除失败";

    setTimeout(() => {
      actionDisabled.value = false;
      actionText.value = '清除翻译缓存';
      actionLoading.value = false;
    }, 1500);
  }
}

// 当前翻译服务名称
const currentServiceLabel = computed(() => {
  const svc = options.services.find((s: any) => s.value === config.value.service);
  return svc?.label || config.value.service || '未知服务';
});

// 面板打开时自动聚焦搜索框
onMounted(() => {
  setTimeout(() => {
    searchInputRef.value?.focus();
  }, 100);
});

// Azure OpenAI 端点地址验证函数
const isValidAzureEndpoint = (endpoint: string) => {
  if (!endpoint || endpoint.trim() === '') {
    return false;
  }

  // 检查是否包含必要的组件
  const hasAzureDomain = endpoint.includes('openai.azure.com');
  const hasChatCompletions = endpoint.includes('/chat/completions');
  const hasHttps = endpoint.startsWith('https://');

  return hasHttps && hasAzureDomain && hasChatCompletions;
};

const handleExport = async () => {
  const configStr = await storage.getItem('local:config');
  if (!configStr) {
    ElMessage({
      message: '没有找到配置信息',
      type: 'warning',
    });
    return;
  }

  const configToExport = JSON.parse(configStr as string);

  // Create a deep copy to avoid modifying the actual config
  const cleanedConfig = JSON.parse(JSON.stringify(configToExport));

  // Clean system_role and user_role if they are default
  if (cleanedConfig.system_role) {
    for (const service in cleanedConfig.system_role) {
      if (cleanedConfig.system_role[service] === defaultOption.system_role) {
        delete cleanedConfig.system_role[service];
      }
    }
    if (Object.keys(cleanedConfig.system_role).length === 0) {
      delete cleanedConfig.system_role;
    }
  }

  if (cleanedConfig.user_role) {
    for (const service in cleanedConfig.user_role) {
      if (cleanedConfig.user_role[service] === defaultOption.user_role) {
        delete cleanedConfig.user_role[service];
      }
    }
    if (Object.keys(cleanedConfig.user_role).length === 0) {
      delete cleanedConfig.user_role;
    }
  }

  exportData.value = JSON.stringify(cleanedConfig, null, 2);
  showExportBox.value = !showExportBox.value;
  showImportBox.value = false;
};

const handleImport = () => {
  showImportBox.value = !showImportBox.value;
  showExportBox.value = false;
};

const saveImport = async () => {
  try {
    const parsedConfig = JSON.parse(importData.value);
    // Add validation here
    if (!validateConfig(parsedConfig)) {
      ElMessage({
        message: '配置无效或格式不正确, 请检查!',
        type: 'error',
      });
      return;
    }
    await storage.setItem('local:config', JSON.stringify(parsedConfig));
    ElMessage({
      message: '配置导入成功!',
      type: 'success',
    });
    showImportBox.value = false;
    importData.value = '';
    // Optionally, reload the extension or relevant parts
  } catch (e) {
    ElMessage({
      message: '配置格式错误, 请检查!',
      type: 'error',
    });
  }
};


// 切换导出配置显示
const toggleExportConfig = async () => {
  if (showExportConfig.value) {
    // 如果已经显示，则隐藏
    showExportConfig.value = false;
    exportedConfig.value = '';
  } else {
    // 如果未显示，则显示并生成配置
    try {
      // 确保从storage获取最新的配置
      const latestConfig = await storage.getItem('local:config');
      let configToExport;

      if (latestConfig && typeof latestConfig === 'string') {
        // 使用storage中的最新配置
        configToExport = JSON.parse(latestConfig);
      } else {
        // 如果storage中没有，使用当前config.value
        configToExport = JSON.parse(JSON.stringify(config.value));
      }

      exportedConfig.value = JSON.stringify(configToExport, null, 2);
      showExportConfig.value = true;

      ElMessage({
        message: '配置已生成，请复制保存',
        type: 'success',
        duration: 2000
      });
    } catch (error) {
      ElMessage({
         message: '导出配置失败：' + ((error as Error)?.message || '未知错误'),
         type: 'error',
         duration: 3000
       });
    }
  }
};

// 复制导出的配置到剪贴板
const copyExportedConfig = async () => {
  try {
    await navigator.clipboard.writeText(exportedConfig.value);
    ElMessage({
      message: '配置已复制到剪贴板',
      type: 'success',
      duration: 2000
    });
  } catch (error) {
    ElMessage({
      message: '复制失败，请手动复制',
      type: 'warning',
      duration: 2000
    });
  }
};

// 切换导入配置显示
const toggleImportConfig = () => {
  if (showImportConfig.value) {
    // 如果已经显示，则隐藏并清空内容
    showImportConfig.value = false;
    importConfigText.value = '';
  } else {
    // 如果未显示，则显示
    showImportConfig.value = true;
    importConfigText.value = '';
  }
};

// 取消导入
const cancelImport = () => {
  // 清空输入框并隐藏导入区域
  importConfigText.value = '';
  showImportConfig.value = false;
  importLoading.value = false;
};

// 导入配置
const importConfig = async () => {
  if (!importConfigText.value.trim()) {
    ElMessage({
      message: '请输入配置内容',
      type: 'warning',
      duration: 2000
    });
    return;
  }

  importLoading.value = true;

  try {
    // 解析JSON配置
    const importedConfig = JSON.parse(importConfigText.value);

    // 验证配置格式
    if (!validateConfig(importedConfig)) {
      throw new Error('配置格式不正确');
    }

    // 确认导入
    await ElMessageBox.confirm(
      '导入配置将覆盖当前所有设置，确定要继续吗？',
      '确认导入',
      {
        confirmButtonText: '确定导入',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 应用新配置
    Object.assign(config.value, importedConfig);

    // 保存到storage
    await storage.setItem('local:config', JSON.stringify(config.value));

    // 隐藏导入区域并清空输入
    showImportConfig.value = false;
    importConfigText.value = '';

    ElMessage({
      message: '配置导入成功',
      type: 'success',
      duration: 2000
    });

  } catch (error) {
    if ((error as Error).message !== 'cancel') {
      ElMessage({
        message: '导入失败：' + ((error as Error).message || '配置格式错误'),
        type: 'error',
        duration: 3000
      });
    }
  } finally {
    importLoading.value = false;
  }
};

// 验证配置格式
const validateConfig = (configData: any): boolean => {
  try {
    // 检查是否是对象
    if (typeof configData !== 'object' || configData === null) {
      return false;
    }

    // 检查必要的配置字段
    const requiredFields = ['on', 'service', 'display', 'from', 'to'];
    for (const field of requiredFields) {
      if (!(field in configData)) {
        return false;
      }
    }

    // 检查服务配置
    if (typeof configData.service !== 'string') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};
// 搜索翻译处理
const handleSearch = async () => {
  const text = searchText.value.trim();
  if (!text) return;

  searchLoading.value = true;
  searchError.value = '';
  searchResult.value = '';
  showSearchResult.value = true;

  try {
    const result = await translateTextStream(
      text,
      '搜索翻译',
      (chunk: string) => {
        searchResult.value += chunk;
      }
    );
    searchResult.value = result;
  } catch (e: any) {
    searchError.value = e?.message || '翻译失败，请检查网络或翻译服务配置';
  } finally {
    searchLoading.value = false;
  }
};

const closeSearchResult = () => {
  showSearchResult.value = false;
  searchResult.value = '';
  searchError.value = '';
};

const copySearchResult = async () => {
  try {
    await navigator.clipboard.writeText(searchResult.value);
    ElMessage({
      message: '复制译文成功',
      type: 'success',
      duration: 2000
    });
  } catch {
    ElMessage({
      message: '复制失败',
      type: 'error',
      duration: 2000
    });
  }
};

</script>

<style scoped>

.select-left {
  text-align: left;
}

.flex-end {
  display: flex;
  justify-content: flex-end;
}

.select-divider {
  background: #f2f6fc;
  color: #409eff;
  font-size: 12px;
  padding: 4px 12px;
  cursor: default;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  border-bottom: 1px solid #e4e7ed;
  margin: 4px 0;
  pointer-events: none;
  opacity: 0.9;
}

.icon-margin {
  margin-left: 0.25em;
}

/* 添加自适应样式 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

.margin-bottom {
  margin-bottom: 10px;
}

.margin-left-2em {
  margin-left: 1em;
  margin-right: 1em;
}

.margin-top-2em {
  margin-top: 1em;
}

.margin-top-1em {
  margin-top: 0.5em;
}

/* 设置滚动条样式 */
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

.refresh-tip {
  margin: 0 1em;
}

.refresh-button {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5em 1em;
  color: #fff;
  background-color: #409eff;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, color 0.3s;
}

.refresh-button:hover {
  background-color: #66b1ff;
  color: #fff;
}

.new-feature-badge {
  display: inline-block;
  font-size: 12px;
  background-color: #f56c6c;
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
  margin-right: 8px;
  font-weight: bold;
  animation: bounce 1s infinite alternate;
}

@keyframes pulse-glow {
  0% {
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
  }
  100% {
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.5);
  }
}

@keyframes bounce {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(-3px);
  }
}

/* 自定义快捷键相关样式 */
.hotkey-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.custom-hotkey-display {
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 10px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 4px;
  font-size: 12px;
  height: 32px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.hotkey-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
  color: var(--el-color-primary);
  font-size: 13px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: calc(100% - 32px);
}

.edit-button {
  padding: 2px 4px;
  margin-left: 4px;
  color: var(--el-color-primary);
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-button:hover {
  background: var(--el-color-primary-light-8);
}

.edit-button .el-icon {
  font-size: 12px;
}

.placeholder-text {
  color: var(--el-text-color-placeholder) !important;
  font-style: italic;
  font-family: inherit !important;
  font-weight: normal !important;
}

/* 自定义快捷键行样式 */
.custom-hotkey-row {
  border-radius: 8px;
  padding: 8px;
  margin: 6px 0 !important;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.03) 0%, 
    rgba(64, 158, 255, 0.01) 50%, 
    rgba(103, 194, 58, 0.02) 100%);
  transition: all 0.3s ease;
  position: relative;
  border: 1px solid transparent;
}

.custom-hotkey-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.2) 0%, 
    rgba(64, 158, 255, 0.1) 30%,
    rgba(103, 194, 58, 0.1) 70%,
    rgba(103, 194, 58, 0.2) 100%);
  border-radius: 8px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.custom-hotkey-row::after {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.3), 
    rgba(103, 194, 58, 0.3));
  border-radius: 8px;
  z-index: -2;
  opacity: 0.6;
}

.custom-hotkey-row:hover {
  background: linear-gradient(135deg, 
    rgba(64, 158, 255, 0.05) 0%, 
    rgba(64, 158, 255, 0.03) 50%, 
    rgba(103, 194, 58, 0.04) 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.custom-hotkey-row:hover::before {
  opacity: 0.1;
}

/* 自定义标识徽章 */
.custom-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: var(--el-color-primary);
  color: white;
  font-size: 10px;
  border-radius: 10px;
  font-weight: 500;
  margin-left: 6px;
  line-height: 1;
}

/* 错误样式 */
.input-error {
  border-color: var(--el-color-danger) !important;
}

.input-error:focus {
  border-color: var(--el-color-danger) !important;
  box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.2) !important;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}

/* 搜索翻译悬浮框样式 */
.search-translation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 20000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
}

.search-translation-popup {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  width: 420px;
  max-width: 90vw;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: searchPopupIn 0.25s ease-out;
}

.search-translation-popup.fr-dark-theme {
  background: #2b2b2b;
  color: #e0e0e0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

@keyframes searchPopupIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.search-translation-popup .fr-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.search-translation-popup.fr-dark-theme .fr-tooltip-header {
  border-bottom-color: #444;
}

.search-translation-popup .fr-tooltip-header small {
  font-weight: normal;
  opacity: 0.6;
  margin-left: 4px;
}

.search-translation-popup .fr-tooltip-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-translation-popup .fr-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: background 0.2s;
}

.search-translation-popup .fr-action-btn:hover {
  background: #f0f0f0;
}

.search-translation-popup.fr-dark-theme .fr-action-btn {
  color: #aaa;
}

.search-translation-popup.fr-dark-theme .fr-action-btn:hover {
  background: #3a3a3a;
}

.search-translation-popup .fr-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  color: #999;
  transition: background 0.2s;
}

.search-translation-popup .fr-close-btn:hover {
  background: #fee;
  color: #e33;
}

.search-translation-popup.fr-dark-theme .fr-close-btn:hover {
  background: #422;
}

.search-translation-popup .fr-tooltip-content {
  padding: 12px 14px;
  overflow-y: auto;
  flex: 1;
}

.search-translation-popup .fr-original-text {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.search-translation-popup.fr-dark-theme .fr-original-text {
  background: #1e1e1e;
  border-left-color: #409eff;
}

.search-translation-popup .fr-original-text pre,
.search-translation-popup .fr-translation-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.6;
  font-family: inherit;
}

.search-translation-popup .fr-no-select {
  user-select: text;
}

.search-translation-popup .fr-translation-result {
  padding: 4px 0;
}

.search-translation-popup .fr-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e0e0e0;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 16px auto;
}

.search-translation-popup .fr-loading-spinner.fr-static {
  animation: none;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-translation-popup .fr-error-message {
  color: #f56c6c;
  font-size: 13px;
  padding: 8px 0;
}

/* 底部操作栏 */
.action-bar-row {
  margin: 0;
  padding: 8px 0;
}

.action-link {
  font-size: 0.75em;
  transition: all 0.6s ease;
  text-decoration: none !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fr-text-color-secondary);
}

.action-link:hover {
  opacity: 0.8;
  color: var(--el-color-primary);
}

.action-link.failed {
  color: var(--el-color-danger) !important;
}

.action-link.success {
  color: var(--el-color-success) !important;
}

:deep(.el-icon-loading) {
  animation: rotating 1s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
/* 高级选项弹窗 */
.advanced-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}
.advanced-panel {
  width: 50%;
  max-height: 100vh;
  overflow-y: auto;
  background: var(--el-bg-color);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  padding: 8px 12px;
}
/* 标签文字 12px */
.advanced-panel .popup-text {
  font-size: 12px !important;
}
/* 控件及所有非标签文字 10px */
.advanced-panel .el-select,
.advanced-panel .el-select .el-select__wrapper,
.advanced-panel .el-select .el-select__placeholder,
.advanced-panel .el-select .el-select__selected-item,
.advanced-panel .el-input__inner,
.advanced-panel .el-checkbox__label,
.advanced-panel .el-button,
.advanced-panel .el-radio__label,
.advanced-panel .el-textarea__inner,
.advanced-panel .el-input-number,
.advanced-panel .el-input__wrapper,
.advanced-panel .el-switch {
  font-size: 10px !important;
}
.advanced-panel .el-switch * {
  font-size: 10px !important;
}
.advanced-panel .margin-bottom {
  margin-bottom: 6px;
}
.advanced-panel .margin-left-2em {
  margin-left: 4px;
  margin-right: 4px;
}
/* 开关缩小 */
.advanced-panel .el-switch {
  --el-switch-height: 18px;
  --el-switch-width: 36px;
  margin: 0 !important;
  vertical-align: middle;
}
.advanced-panel .el-switch .el-switch__core {
  height: 18px !important;
  min-width: 36px !important;
}
.advanced-panel .el-switch .el-switch__action {
  width: 14px !important;
  height: 14px !important;
}
.advanced-panel .el-divider__text {
  font-size: 12px !important;
  white-space: nowrap !important;
}
/* 弹窗内 select 下拉菜单（teleport 到 body） */
.el-select-dropdown__item {
  font-size: 10px !important;
}
</style>
