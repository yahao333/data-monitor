import { createSignal, onMount, For, Show } from "solid-js";
import * as api from "~/lib/api";
import { redis } from "~/lib/upstash";
import type { DataProject } from "~/types";
import {
  ArrowLeft,
  GripHorizontal,
  BarChart3,
  LineChart,
  Activity,
  Database,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-solid";

// Widget type
interface Widget {
  id: string;
  key: string;
  value: unknown;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  chartType: "bar" | "line" | "stat";
}

// Auto-detect chart type based on value type
function detectChartType(value: unknown): Widget["chartType"] {
  if (Array.isArray(value)) return "line";
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const values = Object.values(obj).filter((v) => typeof v === "number");
    if (values.length > 0) return "bar";
  }
  return "stat";
}

// Widget component (简化版，不需要 interactjs)
function WidgetCard(props: { widget: Widget }) {
  // Get chart data
  const getChartData = (): { labels: string[]; values: number[]; max: number } => {
    const value = props.widget.value;
    if (Array.isArray(value)) {
      const nums = value.slice(-30).map(Number).filter((n) => !isNaN(n));
      return {
        labels: nums.map((_, i) => String(value.length - nums.length + i)),
        values: nums,
        max: Math.max(...nums, 1),
      };
    }
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      const entries = Object.entries(obj).filter(([_, v]) => typeof v === "number");
      return {
        labels: entries.map(([k]) => k),
        values: entries.map(([, v]) => Number(v)),
        max: Math.max(...entries.map(([, v]) => Number(v)), 1),
      };
    }
    return { labels: [], values: [], max: 1 };
  };

  const { labels, values, max } = getChartData();
  const displayValue = () => {
    const value = props.widget.value;
    if (Array.isArray(value) && value.length > 0) return String(value[value.length - 1]);
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      const first = Object.values(obj)[0];
      return String(first);
    }
    return String(value);
  };

  const chartTypeIcon = () => {
    switch (props.widget.chartType) {
      case "bar": return <BarChart3 class="w-3 h-3" />;
      case "line": return <LineChart class="w-3 h-3" />;
      default: return <Activity class="w-3 h-3" />;
    }
  };

  return (
    <div
      class="absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
      style={{
        left: 0,
        top: 0,
        width: `${props.widget.width}px`,
        height: `${props.widget.height}px`,
        transform: `translate(${props.widget.x}px, ${props.widget.y}px) rotate(${props.widget.rotation}deg)`,
      }}
    >
      {/* Header */}
      <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
        <GripHorizontal class="w-4 h-4 text-gray-400" />
        <span class="text-sm font-medium truncate max-w-50">{props.widget.key.split(".").pop()?.split("[")[0]}</span>
        <span class="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded capitalize">
          {chartTypeIcon()}
          {props.widget.chartType}
        </span>
      </div>

      {/* Content */}
      <div class="p-4 h-[calc(100%-40px)] overflow-auto">
        {/* Stat - single value */}
        {props.widget.chartType === "stat" && (
          <div class="flex items-center justify-center h-full">
            <div class="text-center">
              <p class="text-5xl font-bold text-blue-600">{displayValue()}</p>
            </div>
          </div>
        )}

        {/* Bar chart */}
        {props.widget.chartType === "bar" && values.length > 0 && (
          <div class="flex items-end justify-center gap-1 h-full pb-4">
            {values.map((val, i) => {
              const height = (val / max) * 100;
              return (
                <div class="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                  <span class="text-[10px] text-gray-400">{String(val).substring(0, 6)}</span>
                  <div class="w-full bg-blue-500 rounded-t transition-all" style={{ height: `${Math.max(height, 2)}%` }} />
                  <span class="text-[10px] text-gray-400 truncate w-full text-center">{labels[i]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Line chart - arrays */}
        {props.widget.chartType === "line" && values.length > 0 && (
          <div class="relative h-full pb-4">
            <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                points={values
                  .map((val: number, i: number) => {
                    const x = (i / Math.max(values.length - 1, 1)) * 100;
                    const y = 100 - (val / max) * 80 - 10;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              {values.length > 0 && (
                <circle
                  cx="100"
                  cy={100 - (values[values.length - 1] / max) * 80 - 10}
                  r="4"
                  fill="#22c55e"
                  stroke="white"
                  stroke-width="1"
                />
              )}
            </svg>
            <div class="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-gray-400 px-1">
              <span>{labels[0] || "0"}</span>
              <span>{labels[labels.length - 1] || String(values.length - 1)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ShareView(props: { token: string }) {
  const [project, setProject] = createSignal<DataProject | null>(null);
  const [widgets, setWidgets] = createSignal<Widget[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [lastUpdated, setLastUpdated] = createSignal<string | null>(null);

  // 加载项目数据
  async function loadData() {
    setIsLoading(true);
    try {
      const proj = await api.getProjectByToken(props.token);
      if (!proj) {
        setError("项目不存在或链接已失效");
        return;
      }
      setProject(proj);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 加载 widgets 布局
  async function loadWidgets() {
    if (!project()) return;
    try {
      const key = `project:${project()!.id}:dashboard`;
      const saved = await redis.get(key) as Widget[] | null;
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setWidgets(saved);
      }
    } catch (err) {
      console.error("[ShareView] 加载布局失败:", err);
    }
  }

  // 刷新数据
  async function refreshData() {
    await loadData();
    await loadWidgets();
  }

  onMount(() => {
    loadData().then(() => loadWidgets());
  });

  // 全屏切换
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  onMount(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });

  return (
    <div class="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div class="flex items-center gap-4">
          <a href="/" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ArrowLeft class="w-5 h-5" />
          </a>
          <div>
            <h1 class="text-lg font-semibold">{project()?.name || "分享监控"}</h1>
            {lastUpdated() && (
              <p class="text-xs text-gray-500">最后更新: {lastUpdated()}</p>
            )}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick={refreshData}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <RefreshCw class="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Fullscreen"
          >
            {isFullscreen() ? <Minimize2 class="w-5 h-5" /> : <Maximize2 class="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 relative overflow-hidden">
        {/* Grid background */}
        <div class="absolute inset-0 opacity-5" style={{ "background-image": "radial-gradient(#000 1px, transparent 1px)", "background-size": "20px 20px" }} />

        {/* Loading */}
        <Show when={isLoading()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-gray-500">加载中...</div>
          </div>
        </Show>

        {/* Error */}
        <Show when={error()}>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-4 py-2 rounded">
              {error()}
            </div>
          </div>
        </Show>

        {/* Empty state */}
        <Show when={!isLoading() && !error() && widgets().length === 0}>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <Database class="w-16 h-16 mb-4 opacity-50" />
            <p class="text-lg">暂无监控组件</p>
            <p class="text-sm mt-2 text-center max-w-xs">
              请在项目中添加组件并保存布局后查看
            </p>
          </div>
        </Show>

        {/* Widgets */}
        <Show when={!isLoading() && !error()}>
          <For each={widgets()}>
            {(widget) => <WidgetCard widget={widget} />}
          </For>
        </Show>
      </div>
    </div>
  );
}
