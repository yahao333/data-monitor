import { createSignal, For, Show } from "solid-js";
import { Button, Input, Textarea, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from "~/components";
import { appStore } from "~/stores";
import { projectApi, dataApi } from "~/lib/api";
import { formatDate } from "~/lib/utils";
import type { DataProject, DataPoint } from "~/types";
import { Trash2, Edit, Share2, Plus, RefreshCw } from "lucide-solid";

export function Home() {
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [showDataModal, setShowDataModal] = createSignal(false);
  const [editingProject, setEditingProject] = createSignal<DataProject | null>(null);
  const [selectedProject, setSelectedProject] = createSignal<DataProject | null>(null);
  const [shareToken, setShareToken] = createSignal("");
  const [isLoading, setIsLoading] = createSignal(false);

  // 表单状态
  const [formData, setFormData] = createSignal({
    name: "",
    description: "",
  });

  // 数据点表单
  const [dataForm, setDataForm] = createSignal({
    name: "",
    value: "",
    unit: "",
  });

  const [dataPoints, setDataPoints] = createSignal<DataPoint[]>([]);

  // 加载项目列表
  async function loadProjects() {
    if (!appStore.isAuthenticated()) return;
    setIsLoading(true);
    try {
      const projects = await projectApi.list();
      appStore.setProjects(projects);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "加载项目失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 加载数据点
  async function loadDataPoints(projectId: string) {
    setIsLoading(true);
    try {
      const data = await dataApi.list(projectId);
      setDataPoints(data);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 创建项目
  async function handleCreateProject() {
    if (!formData().name.trim()) return;
    setIsLoading(true);
    try {
      const newProject = await projectApi.create({
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
      await projectApi.delete(projectId);
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
      const updated = await projectApi.update(editingProject()!.id, {
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
      const updated = await projectApi.regenerateToken(project.id);
      setShareToken(updated.shareToken || "");
      setSelectedProject(project);
      setShowShareModal(true);
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "生成分享链接失败");
    }
  }

  // 添加数据点
  async function handleAddDataPoint() {
    const project = selectedProject();
    if (!project || !dataForm().name || !dataForm().value) return;

    setIsLoading(true);
    try {
      await dataApi.create(project.id, {
        name: dataForm().name,
        value: parseFloat(dataForm().value),
        unit: dataForm().unit,
      });
      await loadDataPoints(project.id);
      setShowDataModal(false);
      setDataForm({ name: "", value: "", unit: "" });
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "添加数据失败");
    } finally {
      setIsLoading(false);
    }
  }

  // 删除数据点
  async function handleDeleteDataPoint(dataPointId: string) {
    const project = selectedProject();
    if (!project || !confirm("确定要删除这个数据点吗？")) return;

    setIsLoading(true);
    try {
      await dataApi.delete(project.id, dataPointId);
      setDataPoints(dataPoints().filter((d) => d.id !== dataPointId));
    } catch (err) {
      appStore.setError(err instanceof Error ? err.message : "删除数据失败");
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
    loadDataPoints(project.id);
  }

  // 复制分享链接
  function copyShareLink() {
    const token = shareToken();
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    alert("链接已复制到剪贴板");
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
          isOpen={!!selectedProject() && !showShareModal() && !showCreateModal()}
          onClose={() => setSelectedProject(null)}
          title={selectedProject()?.name || ""}
        >
          <div class="space-y-4">
            <p class="text-gray-600 dark:text-gray-400">
              {selectedProject()?.description || "暂无描述"}
            </p>

            <div class="flex items-center justify-between">
              <h4 class="font-medium">数据点</h4>
              <Button size="sm" onClick={() => setShowDataModal(true)}>
                <Plus class="mr-1 h-4 w-4" />
                添加数据
              </Button>
            </div>

            <div class="max-h-64 overflow-y-auto">
              <Show
                when={dataPoints().length > 0}
                fallback={<p class="text-gray-500">暂无数据</p>}
              >
                <ul class="space-y-2">
                  <For each={dataPoints()}>
                    {(point) => (
                      <li class="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
                        <div>
                          <p class="font-medium">{point.name}</p>
                          <p class="text-sm text-gray-500">
                            {point.value} {point.unit} · {formatDate(point.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDataPoint(point.id)}
                        >
                          <Trash2 class="h-4 w-4 text-red-500" />
                        </Button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
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

        {/* 添加数据弹窗 */}
        <Modal
          isOpen={showDataModal()}
          onClose={() => {
            setShowDataModal(false);
            setDataForm({ name: "", value: "", unit: "" });
          }}
          title="添加数据"
        >
          <div class="space-y-4">
            <Input
              label="名称"
              value={dataForm().name}
              onInput={(e) => setDataForm({ ...dataForm(), name: e.currentTarget.value })}
              placeholder="数据名称"
            />
            <Input
              label="数值"
              type="number"
              value={dataForm().value}
              onInput={(e) => setDataForm({ ...dataForm(), value: e.currentTarget.value })}
              placeholder="数值"
            />
            <Input
              label="单位（可选）"
              value={dataForm().unit}
              onInput={(e) => setDataForm({ ...dataForm(), unit: e.currentTarget.value })}
              placeholder="如: °C, %, 个等"
            />
            <div class="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDataModal(false);
                  setDataForm({ name: "", value: "", unit: "" });
                }}
              >
                取消
              </Button>
              <Button
                onClick={handleAddDataPoint}
                disabled={!dataForm().name || !dataForm().value}
              >
                添加
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
