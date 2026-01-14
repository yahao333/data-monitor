import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal, JsonEditor } from "~/components";
import { appStore } from "~/stores";
import * as api from "~/lib/api";
import { formatDate } from "~/lib/utils";
import type { DataProject, Webhook } from "~/types";
import { Trash2, Edit, Share2, Plus, RefreshCw, BarChart3, Database, Webhook as WebhookIcon, Copy, Link } from "lucide-solid";

export function Home() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [showDataModal, setShowDataModal] = createSignal(false);
  const [showWebhookModal, setShowWebhookModal] = createSignal(false);
  const [editingProject, setEditingProject] = createSignal<DataProject | null>(null);
  const [selectedProject, setSelectedProject] = createSignal<DataProject | null>(null);
  const [shareToken, setShareToken] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);
  const [webhooks, setWebhooks] = createSignal<Webhook[]>([]);
  const [webhookCreating, setWebhookCreating] = createSignal(false);

  // 表单状态
  const [formData, setFormData] = createSignal({
    name: "",
    description: "",
  });

  // 数据编辑表单
  const [dataForm, setDataForm] = createSignal({
    jsonContent: "{}",
  });
  const [jsonValid, setJsonValid] = createSignal(true);

  // 加载项目列表
  async function loadProjects() {
    if (!appStore.isAuthenticated()) return;
    setIsLoading(true);
    try {
      const projects = await api.listProjects();
      appStore.setProjects(projects);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "加载项目失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 创建项目
  async function handleCreateProject() {
    if (!formData().name.trim()) return;
    setIsLoading(true);
    try {
      const newProject = await api.createProject({
        name: formData().name,
        description: formData().description,
      });
      appStore.setProjects([...appStore.projects(), newProject]);
      setShowCreateModal(false);
      setFormData({ name: "", description: "" });
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "创建项目失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 删除项目
  async function handleDeleteProject(projectId: string) {
    if (!confirm("确定要删除这个项目吗？")) return;
    setIsLoading(true);
    try {
      await api.deleteProject(projectId);
      appStore.setProjects(appStore.projects().filter((p) => p.id !== projectId));
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "删除项目失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 更新项目
  async function handleUpdateProject() {
    if (!editingProject()) return;
    setIsLoading(true);
    try {
      const updated = await api.updateProject(editingProject()!.id, {
        name: formData().name,
        description: formData().description,
      });
      appStore.setProjects(
        appStore.projects().map((p) => (p.id === updated.id ? updated : p))
      );
      setShowCreateModal(false);
      setEditingProject(null);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "更新项目失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 生成分享链接
  async function handleGenerateShareLink(project: DataProject) {
    try {
      const updated = await api.regenerateToken(project.id);
      setShareToken(updated.shareToken || "");
      setSelectedProject(updated);
      setShowShareModal(true);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "生成分享链接失败");
    }
  }

  // 更新项目 JSON 数据
  async function handleUpdateData() {
    const project = selectedProject();
    if (!project || !jsonValid()) return;

    setIsLoading(true);
    try {
      let content: Record<string, unknown> | unknown[];
      try {
        content = JSON.parse(dataForm().jsonContent);
      } catch {
        throw new Error("JSON 格式错误");
      }

      const updated = await api.updateProjectData(project.id, { content });
      appStore.setProjects(
        appStore.projects().map((p) => (p.id === updated.id ? updated : p))
      );
      setSelectedProject(updated);
      setShowDataModal(false);
      setDataForm({ jsonContent: "{}" });
      setJsonValid(true);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "更新数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 打开编辑弹窗
  function openEditModal(project: DataProject) {
    setEditingProject(project);
    setFormData({ name: project.name, description: project.description });
    setShowCreateModal(true);
  }

  // 打开项目详情
  function openProjectDetail(project: DataProject) {
    setSelectedProject(project);
    setDataForm({ jsonContent: JSON.stringify(project.content || {}, null, 2) });
  }

  // 复制分享链接
  function copyShareLink() {
    const token = shareToken();
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    alert("链接已复制到剪贴板");
  }

  // 格式化 JSON 显示
  function formatJsonDisplay(content: Record<string, unknown> | unknown[]): string {
    if (Array.isArray(content)) {
      return `[${content.length} 个元素]`;
    }
    const keys = Object.keys(content);
    if (keys.length === 0) return "{}";
    if (keys.length <= 2) {
      return JSON.stringify(content);
    }
    return `{ ${keys.slice(0, 2).join(", ")}... }`;
  }

  // 打开 webhook 管理弹窗
  async function openWebhookModal(project: DataProject) {
    setSelectedProject(project);
    setShowWebhookModal(true);
    await loadWebhooks(project.id);
  }

  // 加载项目的 webhooks
  async function loadWebhooks(projectId: string) {
    console.log("[Webhook] 开始加载 webhooks:", projectId);
    try {
      const result = await api.listWebhooks(projectId);
      console.log("[Webhook] listWebhooks 返回:", result);
      if (result.success && result.webhooks) {
        console.log("[Webhook] 设置 webhooks 数量:", result.webhooks.length);
        setWebhooks(result.webhooks);
      } else {
        console.log("[Webhook] 无 webhooks, error:", result.error);
        setWebhooks([]);
      }
    } catch (err) {
      console.error("加载 webhooks 失败:", err);
      setWebhooks([]);
    }
  }

  // 创建 webhook
  async function handleCreateWebhook() {
    const project = selectedProject();
    if (!project) return;

    console.log("[Webhook] 开始创建 webhook, projectId:", project.id);
    setWebhookCreating(true);
    try {
      const result = await api.createWebhook(project.id);
      console.log("[Webhook] createWebhook 返回:", result);
      if (result.success) {
        console.log("[Webhook] 创建成功, token:", result.token);
        await loadWebhooks(project.id);
      } else {
        console.log("[Webhook] 创建失败:", result.error);
        appStore.setError(result.error || "创建 webhook 失败");
      }
    } catch (err) {
      console.error("[Webhook] 创建异常:", err);
      appStore.setError(err instanceof Error ? err.message : "创建 webhook 失败");
    } finally {
      setWebhookCreating(false);
    }
  }

  // 删除 webhook
  async function handleDeleteWebhook(token: string) {
    if (!confirm("确定要删除这个 webhook 吗？删除后无法通过此 URL 推送数据。")) return;

    const project = selectedProject();
    if (!project) return;

    try {
      const result = await api.deleteWebhook(project.id, token);
      if (result.success) {
        setWebhooks(webhooks().filter((w) => w.token !== token));
      } else {
        appStore.setError(result.error || "删除 webhook 失败");
      }
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "删除 webhook 失败");
    }
  }

  // 复制 webhook URL
  function copyWebhookUrl(url: string) {
    navigator.clipboard.writeText(url);
    alert("Webhook URL 已复制到剪贴板");
  }

  // 获取 webhook URL
  function getWebhookUrl(token: string): string {
    return api.getWebhookUrl(token);
  }

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 错误提示 */}
        <Show when={appStore.error()}>
          <div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {appStore.error()}
          </div>
        </Show>

        {/* 操作栏 */}
        <Show when={appStore.isAuthenticated()}>
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              我的项目
            </h2>
            <div class="flex gap-2">
              <Button variant="ghost" onClick={loadProjects}>
                <RefreshCw class="mr-2 h-4 w-4" />
                刷新
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus class="mr-2 h-4 w-4" />
                新建项目
              </Button>
            </div>
          </div>
        </Show>

        {/* 未登录状态 */}
        <Show when={!appStore.isAuthenticated()}>
          <div class="text-center">
            <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              欢迎使用数据监控
            </h2>
            <p class="mt-4 text-gray-600 dark:text-gray-400">
              请登录以创建和管理您的数据监控项目
            </p>
          </div>
        </Show>

        {/* 项目列表 */}
        <Show when={appStore.isAuthenticated()}>
          <Show when={!isLoading()} fallback={<div class="text-center">加载中...</div>}>
            <Show
              when={appStore.projects().length > 0}
              fallback={
                <div class="text-center text-gray-500 dark:text-gray-400">
                  暂无项目，点击新建项目开始
                </div>
              }
            >
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <For each={appStore.projects()}>
                  {(project) => (
                    <Card class="cursor-pointer transition-shadow hover:shadow-md">
                      <div
                        onClick={() => openProjectDetail(project)}
                        class="h-full"
                      >
                        <CardHeader>
                          <CardTitle>{project.name}</CardTitle>
                          <CardDescription>
                            {project.description || "暂无描述"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p class="text-sm text-gray-500 dark:text-gray-400">
                            创建时间: {formatDate(project.createdAt)}
                          </p>
                          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            <Database class="inline w-3 h-3 mr-1" />
                            {Array.isArray(project.content)
                              ? `${project.content.length} 个数据项`
                              : `${Object.keys(project.content).length} 个字段`}
                          </p>
                        </CardContent>
                      </div>
                      <div class="mt-4 flex justify-end gap-2 border-t pt-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateShareLink(project);
                          }}
                        >
                          <Share2 class="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(project);
                          }}
                        >
                          <Edit class="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                        >
                          <Trash2 class="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </Card>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </Show>

        {/* 项目详情弹窗 */}
        <Modal
          isOpen={!!selectedProject() && !showShareModal() && !showCreateModal() && !showDataModal() && !showWebhookModal()}
          onClose={() => setSelectedProject(null)}
          title={selectedProject()?.name || ""}
        >
          <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-400">
              {selectedProject()?.description || "暂无描述"}
            </p>

            {/* 数据预览 */}
            <div>
              <h4 class="font-medium mb-2">当前数据</h4>
              <pre class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-40">
                {formatJsonDisplay(selectedProject()?.content || {})}
              </pre>
            </div>

            {/* 操作按钮 */}
            <div class="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  const project = selectedProject();
                  if (project) {
                    setDataForm({ jsonContent: JSON.stringify(project.content || {}, null, 2) });
                    setShowDataModal(true);
                  }
                }}
              >
                <Database class="mr-2 h-4 w-4" />
                编辑数据
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(`/project/${selectedProject()?.id}/dashboard`)}
              >
                <BarChart3 class="mr-2 h-4 w-4" />
                监控屏
              </Button>
              <Button
                variant="secondary"
                onClick={() => selectedProject() && openWebhookModal(selectedProject()!)}
              >
                <WebhookIcon class="mr-2 h-4 w-4" />
                Webhook
              </Button>
            </div>
          </div>
        </Modal>

        {/* 新建/编辑项目弹窗 */}
        <Modal
          isOpen={showCreateModal()}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
            setFormData({ name: "", description: "" });
          }}
          title={editingProject() ? "编辑项目" : "新建项目"}
        >
          <div class="space-y-4">
            <Input
              label="项目名称"
              value={formData().name}
              onInput={(e) => setFormData({ ...formData(), name: e.currentTarget.value })}
              placeholder="输入项目名称"
            />
            <Textarea
              label="描述"
              value={formData().description}
              onInput={(e) => setFormData({ ...formData(), description: e.currentTarget.value })}
              placeholder="输入项目描述"
            />
            <div class="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingProject(null);
                }}
              >
                取消
              </Button>
              <Button
                onClick={editingProject() ? handleUpdateProject : handleCreateProject}
                disabled={!formData().name.trim()}
              >
                {editingProject() ? "保存" : "创建"}
              </Button>
            </div>
          </div>
        </Modal>

        {/* 分享弹窗 */}
        <Modal
          isOpen={showShareModal()}
          onClose={() => {
            setShowShareModal(false);
            setShareToken("");
          }}
          title="分享项目"
        >
          <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-400">
              任何人只要有下面的令牌，就可以查看此项目的公开数据。
            </p>
            <div class="flex gap-2">
              <Input
                value={`${window.location.origin}/share/${shareToken()}`}
                readonly
                class="flex-1"
              />
              <Button onClick={copyShareLink}>复制</Button>
            </div>
          </div>
        </Modal>

        {/* 编辑数据弹窗 */}
        <Modal
          isOpen={showDataModal()}
          onClose={() => {
            setShowDataModal(false);
            setDataForm({ jsonContent: "{}" });
            setJsonValid(true);
          }}
          title="编辑数据 (JSON)"
        >
          <div class="space-y-4">
            <p class="text-sm text-gray-500">
              直接编辑项目的 JSON 数据，监控屏将实时显示这些数据。
            </p>
            <JsonEditor
              value={dataForm().jsonContent}
              onChange={(value, isValid) => {
                setDataForm({ ...dataForm(), jsonContent: value });
                setJsonValid(isValid);
              }}
              placeholder='{"temperature": 25.5, "humidity": 60}'
            />
            <div class="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDataModal(false);
                  setDataForm({ jsonContent: "{}" });
                  setJsonValid(true);
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleUpdateData}
                disabled={!jsonValid()}
              >
                保存
              </Button>
            </div>
          </div>
        </Modal>

        {/* Webhook 管理弹窗 */}
        <Modal
          isOpen={showWebhookModal()}
          onClose={() => {
            setShowWebhookModal(false);
            setWebhooks([]);
          }}
          title="Webhook 管理"
        >
          <div class="space-y-4">
            <p class="text-sm text-gray-500">
              通过 Webhook URL，你可以从外部系统推送数据到此项目。向 URL 发送 POST 请求即可更新数据。
            </p>

            {/* 创建按钮 */}
            <Button
              onClick={handleCreateWebhook}
              disabled={webhookCreating()}
              class="w-full"
            >
              <WebhookIcon class="mr-2 h-4 w-4" />
              {webhookCreating() ? "创建中..." : "创建新的 Webhook"}
            </Button>

            {/* Webhook 列表 */}
            <div class="space-y-3">
              <For each={webhooks()}>
                {(webhook) => (
                  <div class="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Link class="h-4 w-4 text-gray-400" />
                        <span class="text-sm font-mono text-gray-600 dark:text-gray-300">
                          {webhook.token.substring(0, 8)}...
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteWebhook(webhook.token)}
                        class="text-red-500 hover:text-red-600"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                    <div class="flex gap-2">
                      <input
                        type="text"
                        readonly
                        value={getWebhookUrl(webhook.token)}
                        class="flex-1 text-xs bg-white dark:bg-gray-900 border rounded px-2 py-1 font-mono text-gray-600 dark:text-gray-300"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyWebhookUrl(getWebhookUrl(webhook.token))}
                      >
                        <Copy class="h-4 w-4" />
                      </Button>
                    </div>
                    <div class="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>创建时间: {formatDate(webhook.createdAt)}</span>
                      {webhook.lastUsedAt && (
                        <span>最后使用: {formatDate(webhook.lastUsedAt)}</span>
                      )}
                      <span>调用次数: {webhook.callCount}</span>
                    </div>
                  </div>
                )}
              </For>
              <Show when={webhooks().length === 0}>
                <div class="text-center text-gray-400 py-4">
                  暂无 Webhook，点击上方按钮创建
                </div>
              </Show>
            </div>

            {/* 使用说明 */}
            <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
              <p class="font-medium mb-1">使用说明:</p>
              <pre class="text-xs font-mono whitespace-pre-wrap">{`curl -X POST [webhook_url] -H "Content-Type: application/json" -d '{"key": "value"}'`}</pre>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
