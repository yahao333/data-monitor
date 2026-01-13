import { createSignal, onMount, Show, For } from "solid-js";
import { dataApi } from "~/lib/api";
import { formatDate } from "~/lib/utils";
import type { DataPoint } from "~/types";

interface ShareViewProps {
  token: string;
}

export function ShareView(props: ShareViewProps) {
  const [dataPoints, setDataPoints] = createSignal<DataPoint[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // 加载数据
  async function loadData() {
    setIsLoading(true);
    try {
      // 通过令牌获取数据
      const data = await dataApi.listByToken(props.token);
      setDataPoints(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  onMount(() => {
    loadData();
  });

  // 计算统计信息
  const stats = () => {
    const points = dataPoints();
    if (points.length === 0) return { count: 0, avg: "0", max: 0, min: 0 };

    const values = points.map((p) => p.value);
    return {
      count: points.length,
      avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
      max: Math.max(...values),
      min: Math.min(...values),
    };
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
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
        <Show when={!isLoading() && !error()}>
          {/* 统计卡片 */}
          <div class="mb-6 grid gap-4 sm:grid-cols-4">
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">数据点数</p>
              <p class="text-2xl font-bold">{stats().count}</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">平均值</p>
              <p class="text-2xl font-bold">{stats().avg}</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">最大值</p>
              <p class="text-2xl font-bold">{stats().max}</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <p class="text-sm text-gray-500 dark:text-gray-400">最小值</p>
              <p class="text-2xl font-bold">{stats().min}</p>
            </div>
          </div>

          {/* 数据列表 */}
          <div class="rounded-lg bg-white shadow dark:bg-gray-800">
            <div class="border-b px-6 py-4 dark:border-gray-700">
              <h2 class="text-lg font-semibold">数据详情</h2>
            </div>
            <Show
              when={dataPoints().length > 0}
              fallback={
                <div class="p-6 text-center text-gray-500">
                  暂无数据
                </div>
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        名称
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        数值
                      </th>
                      <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                        时间
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    <For each={dataPoints()}>
                      {(point) => (
                        <tr>
                          <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {point.name}
                          </td>
                          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {point.value} {point.unit}
                          </td>
                          <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(point.timestamp)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
