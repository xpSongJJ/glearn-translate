/** Parse complete SSE data events, including an unterminated final event. */
export async function* openaiSSEStream(response: Response): AsyncGenerator<{ content?: string; reasoning?: boolean }> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('翻译响应为空');
    const decoder = new TextDecoder();
    let buffer = '';
    const parse = (line: string) => {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trim();
        if (!data) return;
        if (data === '[DONE]') return { done: true };
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error.message || '翻译服务返回错误');
        const delta = parsed.choices?.[0]?.delta;
        return { content: delta?.content as string | undefined, reasoning: !!delta?.reasoning_content, done: false };
    };
    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            if (done && buffer) { lines.push(buffer); buffer = ''; }
            for (const line of lines) {
                const event = parse(line.trim());
                if (event?.done) return;
                if (event) yield event;
            }
            if (done) break;
        }
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}
