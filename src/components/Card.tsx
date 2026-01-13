import { type JSX } from "solid-js";
import { cn } from "~/lib/utils";

interface CardProps {
  children: JSX.Element;
  class?: string;
}

export function Card(props: CardProps) {
  return (
    <div
      class={cn(
        "rounded-xl border border-gray-200 bg-white p-6 shadow-sm",
        "dark:border-gray-700 dark:bg-gray-800",
        props.class
      )}
    >
      {props.children}
    </div>
  );
}

export function CardHeader(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={cn("mb-4", props.class)}>
      {props.children}
    </div>
  );
}

export function CardTitle(props: { children: JSX.Element; class?: string }) {
  return (
    <h3 class={cn("text-lg font-semibold text-gray-900 dark:text-gray-100", props.class)}>
      {props.children}
    </h3>
  );
}

export function CardDescription(props: { children: JSX.Element; class?: string }) {
  return (
    <p class={cn("text-sm text-gray-500 dark:text-gray-400", props.class)}>
      {props.children}
    </p>
  );
}

export function CardContent(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={cn(props.class)}>
      {props.children}
    </div>
  );
}
