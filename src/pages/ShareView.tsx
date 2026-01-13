import { createSignal, onMount, Show } from "solid-js";
import * as api from "~/lib/api";
import type { DataProject } from "~/types";
import { Database } from "lucide-solid";

export function ShareView(props: { token: string }) {
  const [project, setProject] = createSignal<DataProject | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // 加载数据
  async function loadData() {
    setIsLoading(true);
    try {
      const proj = await api.getProjectByToken(props.token);
      if (!proj) {
        setError("项目不存在或令牌无效");
        return;
      }
      setProject(proj);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  onMount(() => {
    loadData();
  });

  // 格式化 JSON 显示
  function formatJsonDisplay(content: Record<string, unknown> | unknown[]): string {
    if (Array.isArray(content)) {
      return JSON.stringify(content, null, 2);
    }
    return JSON.stringify(content, null, 2);
  }

  // 获取数据统计
  function getDataStats() {
    const content = project()?.content;
    if (!content) return { type: "empty", count: 0 };
    if (Array.isArray(content)) {
      return { type: "array", count: content.length };
    }
    return { type: "object", count: Object.keys(content).length };
  }

  const stats = () => getDataStats();

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* 项目标题 */}
        <Show when={project()}>
          <div class="mb-6">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {project()?.name}
            </h1>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
              {project()?.description || "暂无描述"}
            </p>
          </div>
        </Show>

        {/* 错误提示 */}
        <Show when={error()}>
          <div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error()}
          </div>
        </Show>

        {/* 加载状态 */}
        <Show when={isLoading()}>
          <div class="py-12 text-center">
            <div class="text-gray-500">加载中...</div>
          </div>
        </Show>

        {/* 数据展示 */}
        <Show when={!isLoading() && !error() && project()}>
          {/* 统计卡片 */}
          <div class="mb-6 grid gap-4 sm:grid-cols-4">
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                <Database class="inline w-4 h-4 mr-1" />
                数据类型
              </p>
              <p class="text-2xl font-bold capitalize">{stats().type}</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">数据项数</p>
              <p class="text-2xl font-bold">{stats().count}</p>
            </div>
          </div>

          {/* JSON 数据展示 */}
          <div class="rounded-lg bg-white shadow dark:bg-gray-800">
            <div class="border-b px-6 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold">数据内容</h2>
            </div>
            <div class="p-6">
              <pre class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-x-auto">
                {formatJsonDisplay(project()?.content || {})}
              </pre>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
