"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50",
      // animations
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Hidden description announced to screen readers when no visible description is provided. */
  ariaDescription?: string | null;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, ariaDescription = 'Dialog content', ...restProps }, ref) => {
  const descriptionId = React.useId();
  const childArray = React.Children.toArray(children);
  const hasDescriptionChild = childArray.some((child) =>
    React.isValidElement(child) && (child.type === DialogDescription || child.type === DialogPrimitive.Description)
  );
  const { ['aria-describedby']: ariaDescribedByProp, ...props } = restProps as DialogContentProps & { ['aria-describedby']?: string };
  const shouldRenderHiddenDescription = !hasDescriptionChild && !!ariaDescription;
  const resolvedAriaDescribedBy = ariaDescribedByProp ?? (shouldRenderHiddenDescription ? descriptionId : undefined);

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={resolvedAriaDescribedBy}
        className={cn(
          // Position a bit higher (Bootstrap-like) instead of perfect center
          "fixed left-1/2 top-[18%] z-50 w-full max-w-xl -translate-x-1/2 rounded-[24px] border border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.45)] outline-none",
          // animations
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {shouldRenderHiddenDescription ? (
          <DialogPrimitive.Description id={descriptionId} className="sr-only">
            {ariaDescription}
          </DialogPrimitive.Description>
        ) : null}
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-xl p-1.5 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-100 focus:outline-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />
);

const DialogTitle = DialogPrimitive.Title;
const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <DialogPrimitive.Description className={cn("text-sm text-zinc-400", className)} {...props} />
);

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
