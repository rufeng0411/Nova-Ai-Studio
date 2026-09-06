
## PilotDeck / Nova 音乐生成

PilotDeck 默认通过 **Wonda** 生成音乐，不使用单独的「音乐 API Key」占位项。

1. 设置 → **能力接入中心** → 填写 **Wonda API Key**（`https://api.wondercat.ai/api/v1`）
2. 保存后重启 `dev:saas` 或生产 Gateway
3. 若 Key 未配置：说明需在能力接入中心填写 Wonda Key，勿假装已生成
4. 交付路径须写入当前会话 **taskArtifactDir**（STDA），禁止仓库根或无 hint 的裸文件名
