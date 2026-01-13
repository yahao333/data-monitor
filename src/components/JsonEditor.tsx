import { createSignal, createEffect, Show } from "solid-js";
import type { Component, JSX } from "solid-js";

interface JsonEditorProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  placeholder?: string;
  error?: string;
  class?: string;
}

export const JsonEditor: Component<JsonEditorProps> = (props) => {
  const [localValue, setLocalValue] = createSignal(props.value || "{}");
  const [isValid, setIsValid] = createSignal(true);
  const [errorMsg, setErrorMsg] = createSignal("");

  // 格式化 JSON 字符串
  const formatJson = (str: string): string => {
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  // 验证 JSON
  const validateJson = (str: string): { valid: boolean; message: string } => {
    if (!str.trim()) {
      return { valid: true, message: "" };
    }
    try {
      JSON.parse(str);
      return { valid: true, message: "" };
    } catch (e: unknown) {
      const error = e as Error;
      return { valid: false, message: error.message };
    }
  };

  // 处理输入
  const handleInput: JSX.EventHandler<HTMLTextAreaElement, Event> = (e) => {
    const value = e.currentTarget.value;
    setLocalValue(value);
    const result = validateJson(value);
    setIsValid(result.valid);
    setErrorMsg(result.message);
    props.onChange(value, result.valid);
  };

  // 格式化按钮
  const handleFormat = () => {
    const formatted = formatJson(localValue());
    setLocalValue(formatted);
    const result = validateJson(formatted);
    setIsValid(result.valid);
    setErrorMsg(result.message);
    props.onChange(formatted, result.valid);
  };

  // 初始值同步
  createEffect(() => {
    if (props.value && props.value !== localValue()) {
      setLocalValue(props.value);
      const result = validateJson(props.value);
      setIsValid(result.valid);
      setErrorMsg(result.message);
    }
  });

  return (
    <div class={`flex flex-col ${props.class || ""}`}>
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
          JSON 内容
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={handleFormat}
            class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
          >
            格式化
          </button>
        </div>
      </div>

      <div class="relative">
        <textarea
          value={localValue()}
          onInput={handleInput}
          placeholder={props.placeholder || '{"key": "value"}'}
          class="w-full h-48 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-800 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          classList={{
            "border-red-500": !isValid(),
            "border-gray-300 dark:border-gray-600": isValid(),
          }}
          spellcheck={false}
        />
      </div>

      <Show when={!isValid() || errorMsg()}>
        <p class="mt-1 text-sm text-red-500">{errorMsg() || "JSON 格式错误"}</p>
      </Show>

      <Show when={isValid() && localValue().trim()}>
        <p class="mt-1 text-xs text-gray-400">
          {(() => {
            try {
              const parsed = JSON.parse(localValue());
              const keys = Array.isArray(parsed)
                ? parsed.length
                : Object.keys(parsed).length;
              return `对象包含 ${keys} 个 ${Array.isArray(parsed) ? "元素" : "属性"}`;
            } catch {
              return "";
            }
          })()}
        </p>
      </Show>
    </div>
  );
};
