import { createSignal, createRoot } from "solid-js";
import type { DataProject, DataPoint } from "~/types";

// Clerk 实例类型
let clerkInstance: any = null;

/**
 * 设置全局 Clerk 实例
 */
export function setClerk(instance: any) {
  clerkInstance = instance;
}

/**
 * 获取全局 Clerk 实例
 */
export function getClerk() {
  return clerkInstance;
}

// 应用状态管理
function createAppStore() {
  // 用户状态
  const [user, setUser] = createSignal<{ id: string; email: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = createSignal(false);

  // 项目状态
  const [projects, setProjects] = createSignal<DataProject[]>([]);
  const [currentProject, setCurrentProject] = createSignal<DataProject | null>(null);
  const [projectData, setProjectData] = createSignal<DataPoint[]>([]);

  // 加载状态
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  return {
    user,
    setUser,
    isAuthenticated,
    setIsAuthenticated,
    projects,
    setProjects,
    currentProject,
    setCurrentProject,
    projectData,
    setProjectData,
    isLoading,
    setIsLoading,
    error,
    setError,
  };
}

export const appStore = createRoot(createAppStore);
