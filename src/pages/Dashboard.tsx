import { createSignal, onMount, onCleanup, For, Show, createEffect } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import * as api from "~/lib/api";
import type { DataProject } from "~/types";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Plus,
  X,
  GripHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCw,
  BarChart3,
  LineChart,
  Activity,
  Database,
  ChevronRight,
  ChevronDown,
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

// JSON Node type
interface JsonNode {
  key: string;
  value: unknown;
  path: string;
  isExpanded: boolean;
  children?: JsonNode[];
}

// Generate tree from JSON
function generateJsonTree(obj: unknown, prefix = ""): JsonNode[] {
  if (Array.isArray(obj)) {
    return obj.map((item, index) => ({
      key: `[${index}]`,
      value: item,
      path: prefix ? `${prefix}[${index}]` : `[${index}]`,
      isExpanded: false,
      children: typeof item === "object" && item !== null ? generateJsonTree(item, `[${index}]`) : undefined,
    }));
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).map(([k, v]) => ({
      key: k,
      value: v,
      path: prefix ? `${prefix}.${k}` : k,
      isExpanded: false,
      children: typeof v === "object" && v !== null ? generateJsonTree(v, k) : undefined,
    }));
  }
  return [];
}

// Widget component
function WidgetCard(props: {
  widget: Widget;
  onDelete: () => void;
  onUpdate: (updates: Partial<Widget>) => void;
}) {
  let containerRef: HTMLDivElement | undefined;
  let headerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!containerRef || !headerRef) return;

    // @ts-ignore
    import("interactjs").then((interact: any) => {
      // Drag
      interact.default(headerRef).draggable({
        listeners: {
          move: (event: { target: HTMLElement; dx: number; dy: number }) => {
            const target = event.target.parentElement as HTMLElement;
            const x = (parseFloat(target.dataset.x || "0") || 0) + event.dx;
            const y = (parseFloat(target.dataset.y || "0") || 0) + event.dy;
            target.style.transform = `translate(${x}px, ${y}px) rotate(${props.widget.rotation}deg)`;
            target.dataset.x = String(x);
            target.dataset.y = String(y);
            props.onUpdate({ x, y });
          },
        },
      }).style.cursor("grab");

      // Resize
      interact.default(containerRef).resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        listeners: {
          move: (event: { target: HTMLElement; dataEdge?: { left: boolean; top: boolean; }; deltaRect?: { left: number; top: number; }; rect: { width: number; height: number; }; }) => {
            const target = event.target as HTMLElement;
            let x = parseFloat(target.dataset.x || "0") || 0;
            let y = parseFloat(target.dataset.y || "0") || 0;

            if (event.dataEdge?.left && event.deltaRect) {
              x += event.deltaRect.left;
            }
            if (event.dataEdge?.top && event.deltaRect) {
              y += event.deltaRect.top;
            }

            Object.assign(target.style, {
              width: `${event.rect.width}px`,
              height: `${event.rect.height}px`,
              transform: `translate(${x}px, ${y}px) rotate(${props.widget.rotation}deg)`,
            });

            Object.assign(target.dataset, { x: String(x), y: String(y) });
            props.onUpdate({ x, y, width: event.rect.width, height: event.rect.height });
          },
        },
      });
    });
  });

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
      ref={containerRef}
      class="absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
      style={{
        left: 0,
        top: 0,
        width: `${props.widget.width}px`,
        height: `${props.widget.height}px`,
        transform: `translate(${props.widget.x}px, ${props.widget.y}px) rotate(${props.widget.rotation}deg)`,
      }}
      data-x={props.widget.x}
      data-y={props.widget.y}
    >
      {/* Drag header */}
      <div
        ref={headerRef}
        class="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 cursor-grab active:cursor-grabbing border-b dark:border-gray-600"
      >
        <div class="flex items-center gap-2">
          <GripHorizontal class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-medium truncate max-w-50">{props.widget.key.split(".").pop()?.split("[")[0]}</span>
          <span class="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded capitalize">
            {chartTypeIcon()}
            {props.widget.chartType}
          </span>
        </div>
        <button onClick={props.onDelete} class="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
          <X class="w-4 h-4 text-red-500" />
        </button>
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
              {/* Latest point marker */}
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

// JSON Node component with inline preview
function JsonNodeTree(props: {
  node: JsonNode;
  onAdd: (key: string, value: unknown) => void;
  widgets: Widget[];
}) {
  const [isExpanded, setIsExpanded] = createSignal(props.node.isExpanded);
  const hasChildren = props.node.children && props.node.children.length > 0;

  const handleDragStart = (e: DragEvent) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/json-key", props.node.path);
      e.dataTransfer.setData("application/json-value", JSON.stringify(props.node.value));
      e.dataTransfer.effectAllowed = "copy";
    }
  };

  const handleClick = () => {
    props.onAdd(props.node.path, props.node.value);
  };

  const valuePreview = () => {
    const value = props.node.value;
    if (props.node.children) return `${props.node.children.length} items`;
    if (Array.isArray(value)) {
      const last = value[value.length - 1];
      return `[${value.length}] ${String(last).substring(0, 12)}...`;
    }
    if (typeof value === "string") return `"${value.substring(0, 15)}"`;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);
    return "object";
  };

  const isAdded = () => props.widgets.some((w) => w.key === props.node.path);
  const chartType = () => detectChartType(props.node.value);
  const chartIcon = () => {
    switch (chartType()) {
      case "bar": return <BarChart3 class="w-3 h-3 text-orange-500" />;
      case "line": return <LineChart class="w-3 h-3 text-green-500" />;
      default: return <Activity class="w-3 h-3 text-blue-500" />;
    }
  };

  return (
    <div class="select-none">
      <div
        class={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
          isAdded() ? "bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500" : ""
        }`}
        draggable="true"
        onDragStart={handleDragStart}
        onClick={handleClick}
      >
        <button
          class="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded());
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          {isExpanded() ? <ChevronDown class="w-3 h-3" /> : <ChevronRight class="w-3 h-3" />}
        </button>
        <span class="font-medium text-gray-700 dark:text-gray-300">{props.node.key}</span>
        {isAdded() && <span class="text-xs text-green-500 ml-1">✓</span>}
        <span class="flex items-center gap-1 ml-auto text-xs text-gray-400">
          {chartIcon()}
          {valuePreview()}
        </span>
      </div>
      <Show when={isExpanded() && hasChildren}>
        <div class="ml-4 border-l border-gray-200 dark:border-gray-700 pl-2">
          <For each={props.node.children}>
            {(child) => <JsonNodeTree node={child} onAdd={props.onAdd} widgets={props.widgets} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function Dashboard() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = params.id || "";

  const [project, setProject] = createSignal<DataProject | null>(null);
  const [widgets, setWidgets] = createSignal<Widget[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [jsonTree, setJsonTree] = createSignal<JsonNode[]>([]);
  const [showSidebar, setShowSidebar] = createSignal(true);

  async function loadData() {
    setIsLoading(true);
    try {
      const proj = await api.getProject(projectId);
      setProject(proj || null);
      if (proj?.content) {
        const tree = generateJsonTree(proj.content);
        setJsonTree(tree);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }

  onMount(() => {
    loadData();
  });

  createEffect(() => {
    const proj = project();
    if (proj?.content) {
      setJsonTree(generateJsonTree(proj.content));
    }
  });

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
    onCleanup(() => document.removeEventListener("fullscreenchange", handleFullscreenChange));

    const canvas = document.getElementById("dashboard-canvas");
    if (canvas) {
      canvas.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      });

      canvas.addEventListener("drop", (e) => {
        e.preventDefault();
        const key = e.dataTransfer?.getData("application/json-key");
        const valueStr = e.dataTransfer?.getData("application/json-value");
        if (key && valueStr) {
          try {
            const value = JSON.parse(valueStr);
            addWidget(key, value);
          } catch (err) {
            console.error("Failed to parse dropped data:", err);
          }
        }
      });
    }
  });

  function addWidget(key: string, value: unknown) {
    const widget: Widget = {
      id: crypto.randomUUID(),
      key: key,
      value: value,
      x: 100 + widgets().length * 30,
      y: 100 + widgets().length * 30,
      width: 350,
      height: 250,
      rotation: 0,
      chartType: detectChartType(value),
    };

    setWidgets([...widgets(), widget]);
  }

  function deleteWidget(widgetId: string) {
    setWidgets(widgets().filter((w) => w.id !== widgetId));
  }

  function updateWidget(widgetId: string, updates: Partial<Widget>) {
    setWidgets(widgets().map((w) => (w.id === widgetId ? { ...w, ...updates } : w)));
  }

  function transformWidget(widget: Widget, action: "zoomIn" | "zoomOut" | "rotate") {
    const updates: Partial<Widget> = { ...widget };
    switch (action) {
      case "zoomIn":
        updates.width = widget.width * 1.2;
        updates.height = widget.height * 1.2;
        break;
      case "zoomOut":
        updates.width = Math.max(widget.width * 0.8, 200);
        updates.height = Math.max(widget.height * 0.8, 150);
        break;
      case "rotate":
        updates.rotation = (widget.rotation + 45) % 360;
        break;
    }
    updateWidget(widget.id, updates);
  }

  return (
    <div class="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Toolbar */}
      <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div class="flex items-center gap-4">
          <button onClick={() => navigate("/")} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-lg font-semibold">{project()?.name || "Dashboard"}</h1>
        </div>

        <div class="flex items-center gap-2">
          <button onClick={() => setShowSidebar(!showSidebar())} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Toggle Sidebar">
            <Database class="w-5 h-5" />
          </button>
          <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />

          <button onClick={() => widgets().forEach((w) => transformWidget(w, "zoomOut"))} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Zoom Out">
            <ZoomOut class="w-5 h-5" />
          </button>
          <button onClick={() => widgets().forEach((w) => transformWidget(w, "zoomIn"))} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Zoom In">
            <ZoomIn class="w-5 h-5" />
          </button>
          <button onClick={() => widgets().forEach((w) => transformWidget(w, "rotate"))} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Rotate">
            <RotateCw class="w-5 h-5" />
          </button>

          <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />

          <button onClick={toggleFullscreen} class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            {isFullscreen() ? <Minimize2 class="w-5 h-5" /> : <Maximize2 class="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        {/* Sidebar - JSON Tree */}
        <Show when={showSidebar()}>
          <div class="w-80 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col">
            <div class="px-4 py-3 border-b dark:border-gray-700">
              <h2 class="font-medium flex items-center gap-2">
                <Database class="w-4 h-4" />
                Data
              </h2>
              <p class="text-xs text-gray-500 mt-1">Click or drag to add</p>
            </div>
            <div class="flex-1 overflow-auto p-2">
              <Show when={jsonTree().length > 0} fallback={<p class="text-gray-500 text-sm p-4 text-center">No data</p>}>
                <For each={jsonTree()}>
                  {(node) => <JsonNodeTree node={node} onAdd={addWidget} widgets={widgets()} />}
                </For>
              </Show>
            </div>
          </div>
        </Show>

        {/* Canvas */}
        <div id="dashboard-canvas" class="flex-1 relative overflow-hidden bg-gray-100 dark:bg-gray-900">
          {/* Grid background */}
          <div class="absolute inset-0 opacity-5" style={{ "background-image": "radial-gradient(#000 1px, transparent 1px)", "background-size": "20px 20px" }} />

          <Show when={isLoading()}>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="text-gray-500">Loading...</div>
            </div>
          </Show>

          <Show when={error()}>
            <div class="absolute top-4 left-1/2 -translate-x-1/2">
              <div class="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-4 py-2 rounded">{error()}</div>
            </div>
          </Show>

          <Show when={!isLoading() && widgets().length === 0}>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
              <LineChart class="w-16 h-16 mb-4 opacity-50" />
              <p class="text-lg">No widgets yet</p>
              <p class="text-sm mt-2 text-center max-w-xs">
                Click on a data node in the sidebar<br />or drag it here to add
              </p>
            </div>
          </Show>

          <For each={widgets()}>
            {(widget) => (
              <WidgetCard widget={widget} onDelete={() => deleteWidget(widget.id)} onUpdate={(updates) => updateWidget(widget.id, updates)} />
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
