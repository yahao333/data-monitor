import { type JSX, splitProps } from "solid-js";
import { cn } from "~/lib/utils";

interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea(props: TextareaProps) {
  const [local, others] = splitProps(props, [
    "label",
    "error",
    "class",
    "children",
  ]);

  return (
    <div class="space-y-1">
      {local.label && (
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {local.label}
        </label>
      )}
      <textarea
        class={cn(
          "w-full rounded-lg border border-gray-300 px-4 py-2",
          "bg-white dark:bg-gray-800",
          "text-gray-900 dark:text-gray-100",
          "placeholder-gray-400 dark:placeholder-gray-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "resize-none",
          local.error && "border-red-500 focus:ring-red-500",
          local.class
        )}
        {...others}
      />
      {local.error && (
        <p class="text-sm text-red-600 dark:text-red-400">{local.error}</p>
      )}
    </div>
  );
}
