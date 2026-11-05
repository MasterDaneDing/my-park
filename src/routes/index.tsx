import { createFileRoute } from "@tanstack/react-router";
import { Worksheet } from "@/worksheet/app";

export const Route = createFileRoute("/")({
  component: Worksheet,
});
