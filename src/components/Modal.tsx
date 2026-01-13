import { Dialog as KobalteDialog } from "@kobalte/core/dialog";
import { cn } from "~/lib/utils";
import type { JSX } from "solid-js";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

export function Modal(props: ModalProps) {
  return (
    <KobalteDialog open={props.isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <KobalteDialog.Portal>
        <KobalteDialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <KobalteDialog.Content
            class={cn(
              "w-full max-w-lg rounded-xl bg-white p-6 shadow-xl",
              "dark:bg-gray-800 dark:border dark:border-gray-700"
            )}
          >
            <KobalteDialog.Title class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {props.title}
            </KobalteDialog.Title>
            <div class="mt-4">{props.children}</div>
          </KobalteDialog.Content>
        </div>
      </KobalteDialog.Portal>
    </KobalteDialog>
  );
}
