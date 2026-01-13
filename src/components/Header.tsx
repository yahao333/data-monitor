import { Show } from "solid-js";
import { Button } from "./Button";

interface HeaderProps {
  isAuthenticated: boolean;
  userEmail?: string;
  onLogin: () => void;
  onLogout: () => void;
}

export function Header(props: HeaderProps) {
  return (
    <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
            数据监控
          </h1>
          <div class="flex items-center gap-4">
            <Show
              when={props.isAuthenticated}
              fallback={
                <Button onClick={props.onLogin}>登录</Button>
              }
            >
              <div class="flex items-center gap-4">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {props.userEmail}
                </span>
                <Button variant="secondary" onClick={props.onLogout}>
                  退出
                </Button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}
