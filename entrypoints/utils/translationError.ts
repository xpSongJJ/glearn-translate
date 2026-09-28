export function translationErrorAction(error: string) {
  if (/插件连接已失效|Extension context invalidated/i.test(error) && !error.startsWith('翻译服务返回错误')) {
    return { action: 'refresh', label: '刷新页面', hint: '扩展已更新，请刷新页面后重试。' } as const;
  }
  if (/\b(401|403)\b|unauthorized|authentication|invalid.?api.?key|API Key|Secret Key|Secret ID|密钥|机器人 ID/i.test(error)) {
    return { action: 'credentials', label: '检查密钥', hint: '请检查服务凭据及访问权限。' } as const;
  }
  if (/model.*(not.?found|not.?exist|invalid|unavailable)|模型.*(不存在|不可用|无效)|选择或填写模型/i.test(error)) {
    return { action: 'model', label: '更换模型', hint: '请选用当前服务支持的模型。' } as const;
  }
  if (/接口地址|\b404\b|请选择 AI/i.test(error)) {
    return { action: 'configuration', label: '检查配置', hint: '请检查服务与接口地址。' } as const;
  }
  return { action: 'retry', label: '重试', hint: /\b429\b|rate.?limit|额度|quota/i.test(error)
    ? '请求受限，请检查额度或稍后重试。'
    : /fetch|network|网络|超时|timeout/i.test(error) ? '请检查网络连接后重试。' : '' } as const;
}
