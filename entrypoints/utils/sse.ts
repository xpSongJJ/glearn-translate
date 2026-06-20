/**
 * SSE (Server-Sent Events) 流解析工具
 * 解析 OpenAI-compatible 的 SSE 格式
 */

export async function* openaiSSEStream(response: Response): AsyncGenerator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6).trim();
            if (data === '[DONE]') return;

            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) yield content;
            } catch {
                // 跳过无法解析的行
            }
        }
    }
}
